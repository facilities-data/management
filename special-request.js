(() => {
    const supabaseClient = window.supabaseClient;
    const TABLE_NAME = "special_requests";
    let requests = [];

    const getElement = id => document.getElementById(id);

    const escapeValue = value => {
        const element = document.createElement("div");
        element.textContent = value ?? "";
        return element.innerHTML;
    };

    const createId = () => crypto.randomUUID();

    async function getCurrentUser() {
        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        return user;
    }

    async function loadRequests() {
        const { data, error } = await supabaseClient
            .from(TABLE_NAME)
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Unable to load special requests:", error);
            alert(
                "Unable to load special requests. Check the special_requests table and Supabase policies."
            );
            requests = [];
            renderRequests();
            return;
        }

        requests = data || [];
        renderRequests();
    }

    async function saveRequestToDatabase(request, existingId = "") {
        const user = await getCurrentUser();

        if (!user) {
            alert("Please log in first.");
            return false;
        }

        const record = {
            ...request,
            user_id: user.id,
            updated_at: new Date().toISOString()
        };

        const result = existingId
            ? await supabaseClient
                .from(TABLE_NAME)
                .update(record)
                .eq("id", existingId)
            : await supabaseClient
                .from(TABLE_NAME)
                .insert(record);

        if (result.error) {
            console.error("Unable to save special request:", result.error);
            alert(result.error.message);
            return false;
        }

        await loadRequests();
        return true;
    }

    async function deleteRequestFromDatabase(id) {
        const user = await getCurrentUser();

        if (!user) {
            alert("Please log in first.");
            return;
        }

        const { error } = await supabaseClient
            .from(TABLE_NAME)
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Unable to delete special request:", error);
            alert(error.message);
            return;
        }

        await loadRequests();
    }

    function createSpecialRequestInterface() {
        const menu = document.querySelector(".sidebar-menu");

        if (!menu || getElement("special-request-view")) {
            return;
        }

        const menuItem = document.createElement("li");
        menuItem.dataset.target = "special-request-view";
        menuItem.innerHTML = `
            Special Request
            <span class="nav-count" id="special-request-count"></span>
        `;
        menu.appendChild(menuItem);

        const view = document.createElement("div");
        view.id = "special-request-view";
        view.className = "view-section";
        view.innerHTML = `
            <section class="panel">
                <div class="section-heading">
                    <h2>Special Requests</h2>

                    <button
                        type="button"
                        class="btn-action btn-primary"
                        id="add-special-request"
                    >
                        + Add New Request
                    </button>
                </div>

                <div class="table-wrap">
                    <table id="special-requests-table">
                        <thead>
                            <tr>
                                <th>Request Description</th>
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
                    <h2 id="special-request-modal-title">
                        Add New Special Request
                    </h2>

                    <button
                        type="button"
                        class="modal-close"
                        id="close-special-request"
                    >
                        &times;
                    </button>
                </div>

                <form id="special-request-form">
                    <input type="hidden" id="special-request-id">

                    <div class="form-group">
                        <label for="request-description">
                            Request Description
                        </label>
                        <textarea id="request-description" required></textarea>
                    </div>

                    <div class="form-group">
                        <label for="request-date">Date Requested</label>
                        <input type="date" id="request-date" required>
                    </div>

                    <div class="form-group">
                        <label for="request-action">Action Taken</label>
                        <textarea id="request-action"></textarea>
                    </div>

                    <div class="form-group">
                        <label for="request-status">Status</label>
                        <select id="request-status" required>
                            <option value="" disabled selected hidden>
                                Select Request Status
                            </option>
                            <option>Pending</option>
                            <option>In Progress</option>
                            <option>Completed</option>
                            <option>Cancelled</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="request-completed">
                            Date Completed
                        </label>
                        <input type="date" id="request-completed">
                    </div>

                    <button type="submit" class="btn-submit">
                        Save Request
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        menuItem.onclick = () => {
            document
                .querySelectorAll(".sidebar-menu [data-target], .view-section")
                .forEach(element => element.classList.remove("active"));

            menuItem.classList.add("active");
            view.classList.add("active");
            getElement("page-title").textContent = "Special Request";

            renderRequests();
        };

        getElement("add-special-request").onclick = () =>
            openRequestForm();

        getElement("close-special-request").onclick = closeRequestForm;

        getElement("special-request-form").onsubmit = saveRequest;

        renderRequests();
        loadRequests();

        setTimeout(showSpecialRequestReminder, 500);
    }

    function openRequestForm(id = "") {
        const request = requests.find(item => item.id === id);
        const form = getElement("special-request-form");

        form.reset();

        getElement("special-request-id").value = request?.id || "";
        getElement("request-description").value = request?.description || "";
        getElement("request-date").value =
            request?.requested || new Date().toISOString().slice(0, 10);
        getElement("request-action").value = request?.action || "";
        getElement("request-status").value = request?.status || "";
        getElement("request-completed").value = request?.completed || "";

        getElement("special-request-modal-title").textContent =
            request ? "Edit Special Request" : "Add New Special Request";

        getElement("special-request-modal").classList.add("open");
    }

    function closeRequestForm() {
        getElement("special-request-modal").classList.remove("open");
    }

    async function saveRequest(event) {
        event.preventDefault();

        const existingId = getElement("special-request-id").value;
        const status = getElement("request-status").value;

        const request = {
            id: existingId || createId(),
            description: getElement("request-description").value.trim(),
            requested: getElement("request-date").value,
            action: getElement("request-action").value.trim(),
            status,
            completed: getElement("request-completed").value || null
        };

        if (status === "Completed" && !request.completed) {
            request.completed = new Date().toISOString().slice(0, 10);
        }

        if (await saveRequestToDatabase(request, existingId)) {
            closeRequestForm();
        }
    }

    function renderRequests() {
        const tableBody = document.querySelector(
            "#special-requests-table tbody"
        );

        if (!tableBody) {
            return;
        }

        tableBody.textContent = "";

        requests.forEach(request => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeValue(request.description)}</td>
                <td>${escapeValue(request.requested)}</td>
                <td>${escapeValue(request.action)}</td>
                <td>${escapeValue(request.status)}</td>
                <td>${escapeValue(request.completed || "")}</td>
                <td>
                    <button
                        type="button"
                        class="btn-action btn-primary"
                        data-edit-request="${escapeValue(request.id)}"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn-action btn-danger"
                        data-delete-request="${escapeValue(request.id)}"
                    >
                        Delete
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        tableBody.querySelectorAll("[data-edit-request]").forEach(button => {
            button.onclick = () =>
                openRequestForm(button.dataset.editRequest);
        });

        tableBody.querySelectorAll("[data-delete-request]").forEach(button => {
            button.onclick = () =>
                deleteRequest(button.dataset.deleteRequest);
        });

        const pendingCount = requests.filter(request =>
            request.status !== "Completed" &&
            request.status !== "Cancelled"
        ).length;

        const counter = getElement("special-request-count");

        if (counter) {
            counter.textContent = pendingCount;
            counter.classList.toggle("visible", pendingCount > 0);
        }
    }

    function showSpecialRequestReminder() {
        const openRequests = requests.filter(request =>
            request.status === "Pending" ||
            request.status === "In Progress"
        );

        if (
            !openRequests.length ||
            getElement("special-request-reminder-modal")
        ) {
            return;
        }

        const reminder = document.createElement("div");
        reminder.id = "special-request-reminder-modal";
        reminder.className = "modal";

        reminder.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Special Request Reminder</h2>
                    <button type="button" class="modal-close">
                        &times;
                    </button>
                </div>

                <p>
                    These special requests still require attention:
                </p>

                <div>
                    ${openRequests.map(request => `
                        <div class="reminder-item">
                            <strong>${escapeValue(request.status)}</strong>
                            <br>
                            ${escapeValue(request.description)}
                            <br>
                            <small>
                                Date Requested:
                                ${escapeValue(request.requested)}
                            </small>
                        </div>
                    `).join("")}
                </div>

                <button
                    type="button"
                    class="btn-submit acknowledge-special-requests"
                >
                    Acknowledge Reminder
                </button>
            </div>
        `;

        document.body.appendChild(reminder);
        reminder.classList.add("open");

        const closeReminder = () => {
            reminder.classList.remove("open");

            setTimeout(() => {
                reminder.remove();
            }, 200);
        };

        reminder.querySelector(".modal-close").onclick = closeReminder;
        reminder.querySelector(".acknowledge-special-requests").onclick =
            closeReminder;

        reminder.onclick = event => {
            if (event.target === reminder) {
                closeReminder();
            }
        };
    }

    function deleteRequest(id) {
        const remove = () => {
            if (confirm("Delete this special request?")) {
                deleteRequestFromDatabase(id);
            }
        };

        if (typeof requireAdminPassword === "function") {
            requireAdminPassword("delete this special request").then(allowed => {
                if (allowed) {
                    remove();
                }
            });
            return;
        }

        remove();
    }

    function subscribeToSpecialRequestChanges() {
        supabaseClient
            .channel("special-request-changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: TABLE_NAME
                },
                async () => {
                    await loadRequests();
                }
            )
            .subscribe();
    }

    document.addEventListener("DOMContentLoaded", () => {
        createSpecialRequestInterface();
        // subscribeToSpecialRequestChanges();
    });
})();
