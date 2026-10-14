(() => {
    const decoder = new TextDecoder();

    function normalizeHeader(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    }

    function parseDelimited(text, delimiter) {
        const rows = [];
        let row = [];
        let cell = "";
        let quoted = false;

        for (let index = 0; index < text.length; index++) {
            const character = text[index];

            if (character === '"') {
                if (quoted && text[index + 1] === '"') {
                    cell += '"';
                    index++;
                } else {
                    quoted = !quoted;
                }
            } else if (!quoted && character === delimiter) {
                row.push(cell);
                cell = "";
            } else if (!quoted && (character === "\n" || character === "\r")) {
                row.push(cell);
                if (row.some(value => String(value).trim())) rows.push(row);
                row = [];
                cell = "";
                if (character === "\r" && text[index + 1] === "\n") index++;
            } else {
                cell += character;
            }
        }

        row.push(cell);
        if (row.some(value => String(value).trim())) rows.push(row);
        return rows;
    }

    function columnNumber(reference) {
        const letters = String(reference || "").match(/[A-Z]+/i)?.[0] || "A";
        return [...letters.toUpperCase()].reduce(
            (number, letter) => number * 26 + letter.charCodeAt(0) - 64,
            0
        ) - 1;
    }

    async function unzipEntries(buffer) {
        const bytes = new Uint8Array(buffer);
        const view = new DataView(buffer);
        let endOffset = -1;

        for (let offset = Math.max(0, bytes.length - 65557); offset <= bytes.length - 22; offset++) {
            if (view.getUint32(offset, true) === 0x06054b50) endOffset = offset;
        }

        if (endOffset < 0) throw new Error("This does not appear to be a valid .xlsx workbook.");

        const entryCount = view.getUint16(endOffset + 10, true);
        let directoryOffset = view.getUint32(endOffset + 16, true);
        const entries = new Map();

        for (let index = 0; index < entryCount; index++) {
            if (view.getUint32(directoryOffset, true) !== 0x02014b50) {
                throw new Error("The Excel workbook contains an invalid ZIP directory.");
            }

            const method = view.getUint16(directoryOffset + 10, true);
            const compressedSize = view.getUint32(directoryOffset + 20, true);
            const nameLength = view.getUint16(directoryOffset + 28, true);
            const extraLength = view.getUint16(directoryOffset + 30, true);
            const commentLength = view.getUint16(directoryOffset + 32, true);
            const localOffset = view.getUint32(directoryOffset + 42, true);
            const name = decoder.decode(bytes.subarray(
                directoryOffset + 46,
                directoryOffset + 46 + nameLength
            ));
            const localNameLength = view.getUint16(localOffset + 26, true);
            const localExtraLength = view.getUint16(localOffset + 28, true);
            const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
            const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
            let content;

            if (method === 0) {
                content = compressed;
            } else if (method === 8 && typeof DecompressionStream === "function") {
                const stream = new Blob([compressed])
                    .stream()
                    .pipeThrough(new DecompressionStream("deflate-raw"));
                content = new Uint8Array(await new Response(stream).arrayBuffer());
            } else {
                throw new Error("This browser cannot decompress this .xlsx workbook. Save it as CSV from Excel instead.");
            }

            entries.set(name, content);
            directoryOffset += 46 + nameLength + extraLength + commentLength;
        }

        return entries;
    }

    function parseXml(bytes, description) {
        if (!bytes) return null;
        const xml = new DOMParser().parseFromString(decoder.decode(bytes), "application/xml");
        if (xml.querySelector("parsererror")) {
            throw new Error(`Unable to read ${description} from the workbook.`);
        }
        return xml;
    }

    function resolveSheetPath(entries) {
        const workbook = parseXml(entries.get("xl/workbook.xml"), "the workbook sheet list");
        if (!workbook) throw new Error("The workbook does not contain a readable worksheet.");

        const firstSheet = workbook.getElementsByTagName("sheet")[0];
        const relationshipId = firstSheet?.getAttribute("r:id");
        const relationships = parseXml(
            entries.get("xl/_rels/workbook.xml.rels"),
            "the workbook sheet references"
        );
        const relationship = [...(relationships?.getElementsByTagName("Relationship") || [])]
            .find(item => item.getAttribute("Id") === relationshipId);
        const target = relationship?.getAttribute("Target");

        if (!target) return "xl/worksheets/sheet1.xml";
        const parts = (target.startsWith("/") ? target.slice(1) : `xl/${target}`).split("/");
        const normalized = [];
        parts.forEach(part => {
            if (part === "..") normalized.pop();
            else if (part !== ".") normalized.push(part);
        });
        return normalized.join("/");
    }

    async function parseXlsx(file) {
        const entries = await unzipEntries(await file.arrayBuffer());
        const worksheet = parseXml(entries.get(resolveSheetPath(entries)), "the first worksheet");
        if (!worksheet) throw new Error("The workbook's first worksheet is empty or missing.");

        const sharedXml = parseXml(entries.get("xl/sharedStrings.xml"), "shared cell values");
        const sharedStrings = [...(sharedXml?.getElementsByTagName("si") || [])]
            .map(item => [...item.getElementsByTagName("t")]
                .map(text => text.textContent || "")
                .join(""));

        return [...worksheet.getElementsByTagName("row")].map(xmlRow => {
            const cells = [];
            [...xmlRow.getElementsByTagName("c")].forEach(cell => {
                const type = cell.getAttribute("t");
                const value = cell.getElementsByTagName("v")[0]?.textContent || "";
                let parsed = value;

                if (type === "s") parsed = sharedStrings[Number(value)] ?? "";
                if (type === "inlineStr") {
                    parsed = [...cell.getElementsByTagName("t")]
                        .map(text => text.textContent || "")
                        .join("");
                }
                if (type === "b") parsed = value === "1" ? "TRUE" : "FALSE";
                cells[columnNumber(cell.getAttribute("r"))] = parsed;
            });
            return cells;
        }).filter(row => row.some(value => String(value ?? "").trim()));
    }

    async function readRows(file) {
        const extension = file.name.split(".").pop().toLowerCase();
        if (extension === "xlsx") return parseXlsx(file);
        if (!["csv", "tsv", "txt"].includes(extension)) {
            throw new Error("Choose an .xlsx workbook or an Excel-exported .csv/.tsv file.");
        }

        const text = (await file.text()).replace(/^\uFEFF/, "");
        const firstLine = text.split(/\r?\n/, 1)[0] || "";
        const delimiter = extension === "tsv" || (extension === "txt" && firstLine.includes("\t"))
            ? "\t"
            : firstLine.includes("\t") && !firstLine.includes(",")
                ? "\t"
                : firstLine.includes(";") && !firstLine.includes(",")
                    ? ";"
                    : ",";
        return parseDelimited(text, delimiter);
    }

    function excelDate(value) {
        if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value || "").trim())) {
            const serial = Number(value);
            if (serial >= 1 && serial < 100000) {
                const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
                return date.toISOString().slice(0, 10);
            }
        }

        const text = String(value || "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
        const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (match) {
            const month = Number(match[1]);
            const day = Number(match[2]);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            }
        }

        const parsed = new Date(text);
        return text && !Number.isNaN(parsed.getTime())
            ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
            : "";
    }

    function excelMonth(value) {
        const text = String(value || "").trim();
        const monthMatch = text.match(/^(\d{4})[-/](\d{1,2})$/);
        if (monthMatch) {
            const month = Number(monthMatch[2]);
            return month >= 1 && month <= 12
                ? `${monthMatch[1]}-${String(month).padStart(2, "0")}`
                : "";
        }
        const date = excelDate(value);
        if (date) return date.slice(0, 7);
        const parsed = new Date(text);
        return text && !Number.isNaN(parsed.getTime())
            ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`
            : "";
    }

    function findColumn(headers, aliases) {
        const wanted = new Set(aliases.map(normalizeHeader));
        return headers.findIndex(header => wanted.has(normalizeHeader(header)));
    }

    function canonicalChoice(value, choices) {
        const normalized = normalizeHeader(value);
        return choices.find(choice => normalizeHeader(choice) === normalized) || "";
    }

    const assetColumns = {
        id: ["id", "asset tag", "asset id", "asset barcode", "barcode"],
        name: ["name", "item name", "asset name", "item description"],
        location: ["location", "location assigned", "assigned location"],
        status: ["status", "health status", "asset status"],
        inspected: ["inspected", "last inspected", "date inspected", "inspection date"]
    };
    const safetyColumns = {
        id: ["id", "barcode", "barcode id", "equipment id", "barcode equipment id"],
        type: ["type", "equipment type"],
        name: ["name", "equipment name", "equipment name description", "description"],
        location: ["location", "location assigned"],
        month: ["month", "inspection month"],
        inspected: ["inspected", "date inspected", "inspection date"],
        status: ["status", "inspection status"],
        remarks: ["remarks", "notes", "remarks and other notes"]
    };
    const assetStatuses = ["Operational", "Attention Needed", "Out of Service"];
    const safetyTypes = ["Fire Extinguisher", "Emergency Light", "FDAS", "AED"];
    const safetyStatuses = ["Passed", "Attention Needed", "Failed", "Not Inspected"];

    function prepareRecords(rows, kind) {
        if (rows.length < 2) throw new Error("The selected spreadsheet has no data rows.");
        const columns = kind === "assets" ? assetColumns : safetyColumns;
        const headers = rows[0].map(value => String(value ?? "").trim());
        const indexes = Object.fromEntries(Object.entries(columns).map(([key, aliases]) => [
            key,
            findColumn(headers, aliases)
        ]));
        const required = kind === "assets"
            ? ["id", "name", "location", "status", "inspected"]
            : ["id", "type", "name", "location", "inspected", "status"];
        const missing = required.filter(key => indexes[key] < 0);
        if (missing.length) {
            throw new Error(`Missing required column(s): ${missing.join(", ")}. Use the field names shown in the tracker.`);
        }

        const valid = [];
        const problems = [];
        const fileIds = new Set();

        rows.slice(1).forEach((row, offset) => {
            const line = offset + 2;
            const value = key => String(row[indexes[key]] ?? "").trim();
            if (!row.some(item => String(item ?? "").trim())) return;

            const record = {
                id: value("id"),
                name: value("name"),
                location: value("location")
            };
            const issue = message => problems.push(`Row ${line}: ${message}`);

            if (!record.id || !record.name || !record.location) {
                issue("ID, name, and location are required.");
                return;
            }
            const normalizedId = record.id.toLowerCase();
            if (fileIds.has(normalizedId)) {
                issue(`duplicate ID “${record.id}” in this file.`);
                return;
            }

            record.inspected = excelDate(value("inspected"));
            if (!record.inspected) {
                issue("enter a valid inspection date (for example, 2026-04-30).");
                return;
            }

            if (kind === "assets") {
                record.status = canonicalChoice(value("status"), assetStatuses);
                if (!record.status) {
                    issue(`status must be ${assetStatuses.join(", ")}.`);
                    return;
                }
            } else {
                record.type = canonicalChoice(value("type"), safetyTypes);
                record.status = canonicalChoice(value("status"), safetyStatuses);
                record.remarks = indexes.remarks >= 0 ? value("remarks") : "";
                const inspectionMonth = excelMonth(indexes.month >= 0 ? value("month") : "")
                    || record.inspected.slice(0, 7);

                if (!record.type) {
                    issue(`equipment type must be ${safetyTypes.join(", ")}.`);
                    return;
                }
                if (!record.status) {
                    issue(`inspection status must be ${safetyStatuses.join(", ")}.`);
                    return;
                }
                record.inspection_month = `${inspectionMonth}-01`;
            }

            fileIds.add(normalizedId);
            valid.push(record);
        });

        return { valid, problems };
    }

    function setStatus(element, message, isError = false) {
        element.textContent = message;
        element.classList.toggle("is-error", isError);
    }

    async function importFile(file, kind, statusElement, button) {
        if (!file) return;
        button.disabled = true;
        setStatus(statusElement, "Reading spreadsheet…");

        try {
            const rows = await readRows(file);
            const { valid, problems } = prepareRecords(rows, kind);
            const currentIds = new Set(cache[kind].map(record => String(record.id).toLowerCase()));
            const records = valid.filter(record => !currentIds.has(record.id.toLowerCase()));
            const duplicates = valid.length - records.length;

            if (!records.length) {
                const message = valid.length
                    ? `No new records imported; ${duplicates} ID(s) already exist.`
                    : `No records imported. ${problems.slice(0, 3).join(" ")}`;
                setStatus(statusElement, message, true);
                return;
            }

            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            if (userError || !user) throw new Error("Please sign in before importing records.");

            const now = new Date().toISOString();
            let imported = 0;
            const successfulRecords = [];
            const failures = [];
            for (let offset = 0; offset < records.length; offset += 200) {
                const sourceBatch = records.slice(offset, offset + 200);
                const batch = sourceBatch.map(record => ({
                    ...record,
                    user_id: user.id,
                    updated_at: now
                }));
                const { error } = await supabaseClient.from(TABLES[kind]).insert(batch);
                if (error) failures.push(error.message);
                else {
                    imported += batch.length;
                    successfulRecords.push(...sourceBatch);
                }
            }

            if (kind === "safety" && imported) {
                successfulRecords.forEach(record => {
                    const history = {
                        [record.inspection_month.slice(0, 7)]: {
                            inspected: record.inspected,
                            status: record.status,
                            remarks: record.remarks
                        }
                    };
                    try {
                        localStorage.setItem(`fms-safety-history-${record.id}`, JSON.stringify(history));
                    } catch (storageError) {
                        console.warn("Unable to cache imported inspection history:", storageError);
                    }
                });
            }

            if (imported) await renderAll();

            const details = [
                `${imported} imported`,
                duplicates ? `${duplicates} existing ID(s) skipped` : "",
                problems.length
                    ? `${problems.length} invalid row(s) skipped: ${problems.slice(0, 3).join(" ")}`
                    : "",
                failures.length ? `${failures.length} database batch(es) failed: ${failures[0]}` : ""
            ].filter(Boolean).join(" · ");
            setStatus(statusElement, details, Boolean(problems.length || failures.length));
            if (imported) showNotification(`${imported} ${kind === "assets" ? "asset" : "safety equipment"} record(s) imported.`);
        } catch (error) {
            console.error("Bulk import failed:", error);
            setStatus(statusElement, error.message || "Unable to import this spreadsheet.", true);
        } finally {
            button.disabled = false;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        [
            { kind: "assets", buttonId: "import-assets-button", fileId: "import-assets-file", statusId: "asset-import-status" },
            { kind: "safety", buttonId: "import-safety-button", fileId: "import-safety-file", statusId: "safety-import-status" }
        ].forEach(({ kind, buttonId, fileId, statusId }) => {
            const button = document.getElementById(buttonId);
            const fileInput = document.getElementById(fileId);
            const status = document.getElementById(statusId);
            if (!button || !fileInput || !status) return;

            button.addEventListener("click", () => fileInput.click());
            fileInput.addEventListener("change", () => {
                importFile(fileInput.files?.[0], kind, status, button);
                fileInput.value = "";
            });
        });
    });
})();
