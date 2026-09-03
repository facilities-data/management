(() => {
    const client = window.supabaseClient;
    const today = () => new Date().toISOString().slice(0, 10);

    const escapeHtml = value => {
        const element = document.createElement("div");
        element.textContent = value ?? "";
        return element.innerHTML;
    };

    const getCurrentUser = async () => {
        const { data } = await client.auth.getUser();
        return data.user;
    };

    const getRows = async table => {
        const { data, error } = await client
            .from(table)
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error(`Unable to load ${table}:`, error);
            return [];
        }

        return data || [];
    };

    const saveRow = async (table, row, id = "") => {
        const user = await getCurrentUser();

        if (!user) {
            alert("Please log in first.");
            return false;
        }

        const record = {
            ...row,
            user_id: user.id,
            updated_at: new Date().toISOString()
        };

        const result = id
            ? await client.from(table).update(record).eq("id", id)
            : await client.from(table).insert(record);

        if (result.error) {
            alert(result.error.message);
            console.error(result.error);
            return false;
        }

        return true;
    };

    function createSpecialRequestInterface() {
        if (
            !document.querySelector(".sidebar-menu") ||
            document.getElementById("special-request-view")
        ) {
            return;
        }

        const menuItem = document.createElement("li");
        menuItem.dataset.target = "special-request-view";
        menuItem.innerHTML = `
            Special Requests
            <span class="nav-count" id="special-request-count"></span>
        `;

        document.querySelector(".sidebar-menu").appendChild(menuItem);

        const view = document.createElement("div");
        view.id = "special-request-view";
        view.className = "view-section";
        view.innerHTML = `
            <section class="panel">
                <div class="section-heading">
                    <h2>Special Requests</h2>
                    <button class="btn-action btn-primary"
                        id="add-special-request">
                        + Add New Request
                    </button>
                </div>

                <div class="table-wrap">
                    <table id="special-requests-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Date Requested</th>
                                <th>Action Taken</th>
                                <th>Status</th>
                                <th>Date Completed</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </section>
        `;

        document.querySelector(".main-content").appendChild(view);

        const modal = document.createElement("div");
        modal.id = "special-request-modal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="special-request-title">Add Special Request</h2>
                    <button class="modal-close" type="button">&times;</button>
                </div>

                <form id="special-request-form">
                    <input type="hidden" id="special-request-record-id">

                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="special-request-description" required></textarea>
                    </div>

                    <div class="form-group">
                        <label>Date Requested</label>
                        <input type="date" id="special-request-date" required>
                    </div>

                    <div class="form-group">
                        <label>Action Taken</label>
                        <textarea id="special-request-action"></textarea>
                    </div>

                    <div class="form-group">
                        <label>Status</label>
                        <select id="special-request-status" required>
                            <option value="">Select Status</option>
                            <option>Pending</option>
                            <option>In Progress</option>
                            <option>Completed</option>
                            <option>Cancelled</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Date Completed</label>
                        <input type="date" id="special-request-completed">
                    </div>

                    <button class="btn-submit">Save Request</button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        const form = document.getElementById("special-request-form");

        const close = () => modal.classList.remove("open");

        const openForm = async id => {
            const rows = await getRows("special_requests");
            const request = rows.find(row => row.id === id);

            form.reset();
            document.getElementById("special-request-record-id").value =
                request?.id || "";
            document.getElementById("special-request-description").value =
                request?.description || "";
            document.getElementById("special-request-date").value =
                request?.requested || today();
            document.getElementById("special-request-action").value =
                request?.action || "";
            document.getElementById("special-request-status").value =
                request?.status || "";
            document.getElementById("special-request-completed").value =
                request?.completed || "";

            document.getElementById("special-request-title").textContent =
                request ? "Edit Special Request" : "Add Special Request";

            modal.classList.add("open");
        };

        const render = async () => {
            const body = document.querySelector(
                "#special-requests-table tbody"
            );

            if (!body) {
                return;
            }

            const rows = await getRows("special_requests");
            body.textContent = "";

            rows.forEach(request => {
                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${escapeHtml(request.description)}</td>
                    <td>${escapeHtml(request.requested)}</td>
                    <td>${escapeHtml(request.action)}</td>
                    <td>${escapeHtml(request.status)}</td>
                    <td>${escapeHtml(request.completed || "")}</td>
                    <td>
                        <button class="btn-action btn-primary"
                            data-edit-special="${escapeHtml(request.id)}">
                            Edit
                        </button>
                        <button class="btn-action btn-danger"
                            data-delete-special="${escapeHtml(request.id)}">
                            Delete
                        </button>
                    </td>
                `;

                body.appendChild(row);
            });

            body.querySelectorAll("[data-edit-special]").forEach(button => {
                button.onclick = () => openForm(button.dataset.editSpecial);
            });

            body.querySelectorAll("[data-delete-special]").forEach(button => {
                button.onclick = async () => {
                    if (!confirm("Delete this special request?")) {
                        return;
                    }

                    const { error } = await client
                        .from("special_requests")
                        .delete()
                        .eq("id", button.dataset.deleteSpecial);

                    if (error) {
                        alert(error.message);
                        return;
                    }

                    await render();
                };
            });

            const count = rows.filter(row =>
                row.status === "Pending" || row.status === "In Progress"
            ).length;

            const counter = document.getElementById("special-request-count");

            if (counter) {
                counter.textContent = count;
                counter.classList.toggle("visible", count > 0);
            }
        };

        menuItem.onclick = () => {
            document
                .querySelectorAll(".sidebar-menu [data-target], .view-section")
                .forEach(element => element.classList.remove("active"));

            menuItem.classList.add("active");
            view.classList.add("active");
            document.getElementById("page-title").textContent =
                "Special Requests";

            render();
        };

        document.getElementById("add-special-request").onclick =
            () => openForm();

        modal.querySelector(".modal-close").onclick = close;

        form.onsubmit = async event => {
            event.preventDefault();

            const status = document.getElementById(
                "special-request-status"
            ).value;

            const record = {
                id: document.getElementById(
                    "special-request-record-id"
                ).value || `SR-${Date.now()}`,
                description: document.getElementById(
                    "special-request-description"
                ).value.trim(),
                requested: document.getElementById(
                    "special-request-date"
                ).value,
                action: document.getElementById(
                    "special-request-action"
                ).value.trim(),
                status,
                completed: document.getElementById(
                    "special-request-completed"
                ).value || (status === "Completed" ? today() : null)
            };

            const saved = await saveRow(
                "special_requests",
                record,
                document.getElementById("special-request-record-id").value
            );

            if (saved) {
                close();
                await render();
            }
        };

        render();
    }

    function addWorkOrderSearch() {
        const table = document.querySelector("#work-orders-table");

        if (!table || document.getElementById("merged-order-search")) {
            return;
        }

        const input = document.createElement("input");
        input.id = "merged-order-search";
        input.className = "search";
        input.placeholder =
            "Search work orders by ID, location, category, priority, or status";

        table.closest(".panel")
            ?.querySelector(".section-heading")
            ?.insertAdjacentElement("afterend", input);

        input.oninput = () => {
            const search = input.value.toLowerCase().trim();

            table.querySelectorAll("tbody tr").forEach(row => {
                row.hidden = !row.textContent.toLowerCase().includes(search);
            });
        };
    }

    function addLogIssueModal() {
        const form = document.getElementById("facility-form");
        const panel = form?.closest(".panel");
        const ordersPanel = document
            .getElementById("work-orders-table")
            ?.closest(".panel");

        if (!form || !panel || !ordersPanel ||
            document.getElementById("merged-log-issue")) {
            return;
        }

        panel.hidden = true;

        const button = document.createElement("button");
        button.id = "merged-log-issue";
        button.className = "report-button";
        button.type = "button";
        button.textContent = "+ Log New Issue";

        ordersPanel.querySelector(".section-heading")
            ?.appendChild(button);

        const modal = document.createElement("div");
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Log New Issue</h2>
                    <button class="modal-close" type="button">&times;</button>
                </div>
                <p>Complete the maintenance form below.</p>
            </div>
        `;

        document.body.appendChild(modal);

        button.onclick = () => {
            modal.querySelector(".modal-content").appendChild(form);
            form.hidden = false;
            modal.classList.add("open");
        };

        modal.querySelector(".modal-close").onclick = () => {
            modal.classList.remove("open");
            panel.appendChild(form);
            form.hidden = false;
        };
    }

    async function downloadProfessionalReport(title, tables, fileName) {
        const sections = [];

        for (const [sectionTitle, table] of Object.entries(tables)) {
            sections.push({
                title: sectionTitle,
                rows: await getRows(table)
            });
        }

        const html = `
            <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial; color: #1e293b; }
                        h1 { background: #0f766e; color: white; padding: 20px; }
                        h2 { color: #0f766e; border-left: 5px solid #14b8a6;
                             padding-left: 10px; }
                        table { border-collapse: collapse; width: 100%;
                                margin-bottom: 25px; }
                        th { background: #0f766e; color: white; }
                        th, td { border: 1px solid #cbd5e1; padding: 8px;
                                 text-align: left; }
                        tr:nth-child(even) { background: #f0fdfa; }
                    </style>
                </head>
                <body>
                    <h1>Facilities Management System</h1>
                    <p>${escapeHtml(title)} — ${today()}</p>
                    ${sections.map(section => {
                        const columns = Object.keys(
                            section.rows[0] || { Record: "" }
                        );

                        return `
                            <h2>${escapeHtml(section.title)}</h2>
                            <table>
                                <tr>
                                    ${columns.map(column =>
                                        `<th>${escapeHtml(column)}</th>`
                                    ).join("")}
                                </tr>
                                ${section.rows.map(row => `
                                    <tr>
                                        ${columns.map(column =>
                                            `<td>${escapeHtml(
                                                row[column] ?? ""
                                            )}</td>`
                                        ).join("")}
                                    </tr>
                                `).join("")}
                            </table>
                        `;
                    }).join("")}
                </body>
            </html>
        `;

        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([html], {
            type: "application/vnd.ms-excel"
        }));
        link.download = `${fileName}-${today()}.xls`;
        link.click();

        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    function replaceReportButtons() {
        const reports = {
            "download-pms-report": {
                title: "52-Week PMS Calendar",
                tables: { "PMS Tasks": "pms_tasks" },
                file: "pms-calendar"
            },
            "download-orders-report": {
                title: "Active Maintenance Work Orders",
                tables: { "Work Orders": "work_orders" },
                file: "maintenance-work-orders"
            },
            "download-projects-report": {
                title: "Project Management",
                tables: { Projects: "projects" },
                file: "projects"
            },
            "download-assets-report": {
                title: "Asset Tracking",
                tables: { Assets: "assets" },
                file: "assets"
            },
            "download-vendors-report": {
                title: "Vendor Directory",
                tables: { Vendors: "vendors" },
                file: "vendors"
            },
            "download-report": {
                title: "Complete Facilities Management Report",
                tables: {
                    "PMS Tasks": "pms_tasks",
                    "Work Orders": "work_orders",
                    Projects: "projects",
                    Assets: "assets",
                    Vendors: "vendors",
                    "Special Requests": "special_requests"
                },
                file: "facilities-report"
            }
        };

        Object.entries(reports).forEach(([id, report]) => {
            const button = document.getElementById(id);

            if (button) {
                button.onclick = () => downloadProfessionalReport(
                    report.title,
                    report.tables,
                    report.file
                );
            }
        });
    }

    function initializeMergedFeatures() {
        if (!window.supabaseClient) {
            return;
        }

        createSpecialRequestInterface();
        addWorkOrderSearch();
        addLogIssueModal();
        replaceReportButtons();
    }

    document.addEventListener("DOMContentLoaded", () => {
        const timer = setInterval(() => {
            if (
                document.getElementById("work-orders-table") &&
                document.querySelector(".main-content")?.style.display !== "none"
            ) {
                clearInterval(timer);
                initializeMergedFeatures();
            }
        }, 300);

        setTimeout(() => clearInterval(timer), 30000);
    });
})();