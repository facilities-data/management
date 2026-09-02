(() => {
    const STORAGE_KEY = "fms_special_requests";

    const getRequests = () => {
        try {
            const requests = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return Array.isArray(requests) ? requests : [];
        } catch {
            return [];
        }
    };

    const saveRequests = requests => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    };

    const escapeValue = value => {
        const element = document.createElement("div");
        element.textContent = value ?? "";
        return element.innerHTML;
    };

    const createId = () =>
        `SR-${String(Date.now()).slice(-6)}`;

    function createSpecialRequestInterface() {
        const menu = document.querySelector(".sidebar-menu");

        if (!menu || document.getElementById("special-request-view")) {
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
            document.getElementById("page-title").textContent =
                "Special Request";

            renderRequests();
        };

        document.getElementById("add-special-request").onclick = () =>
            openRequestForm();

        document.getElementById("close-special-request").onclick = () =>
            closeRequestForm();

        document.getElementById("special-request-form").onsubmit =
            saveRequest;

        renderRequests();

        setTimeout(showSpecialRequestReminder, 300);
    }

    function openRequestForm(id = "") {
        const request = getRequests().find(item => item.id === id);
        const form = document.getElementById("special-request-form");

        form.reset();

        document.getElementById("special-request-id").value =
            request?.id || "";

        document.getElementById("request-description").value =
            request?.description || "";

        document.getElementById("request-date").value =
            request?.requested || new Date().toISOString().slice(0, 10);

        document.getElementById("request-action").value =
            request?.action || "";

        document.getElementById("request-status").value =
            request?.status || "";

        document.getElementById("request-completed").value =
            request?.completed || "";

        document.getElementById("special-request-modal-title").textContent =
            request ? "Edit Special Request" : "Add New Special Request";

        document
            .getElementById("special-request-modal")
            .classList.add("open");
    }

    function closeRequestForm() {
        document
            .getElementById("special-request-modal")
            .classList.remove("open");
    }

    function saveRequest(event) {
        event.preventDefault();

        const requests = getRequests();
        const existingId =
            document.getElementById("special-request-id").value;

        const status = document.getElementById("request-status").value;

        const request = {
            id: existingId || createId(),
            description: document
                .getElementById("request-description")
                .value.trim(),
            requested: document.getElementById("request-date").value,
            action: document
                .getElementById("request-action")
                .value.trim(),
            status,
            completed: document.getElementById("request-completed").value
        };

        if (status === "Completed" && !request.completed) {
            request.completed = new Date().toISOString().slice(0, 10);
        }

        const index = requests.findIndex(item => item.id === request.id);

        if (index === -1) {
            requests.unshift(request);
        } else {
            requests[index] = request;
        }

        saveRequests(requests);
        closeRequestForm();
        renderRequests();
    }

    function renderRequests() {
        const tableBody = document.querySelector(
            "#special-requests-table tbody"
        );

        if (!tableBody) {
            return;
        }

        tableBody.textContent = "";

        getRequests().forEach(request => {
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

        const pendingCount = getRequests().filter(request =>
            request.status !== "Completed" &&
            request.status !== "Cancelled"
        ).length;

        const counter = document.getElementById("special-request-count");

        if (counter) {
            counter.textContent = pendingCount;
            counter.classList.toggle("visible", pendingCount > 0);
        }
    }

    function showSpecialRequestReminder() {
        const openRequests = getRequests().filter(request =>
            request.status === "Pending" ||
            request.status === "In Progress"
        );

        if (!openRequests.length ||
            document.getElementById("special-request-reminder-modal")) {
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
                    ${openRequests
                        .map(request => `
                            <div class="reminder-item">
                                <strong>
                                    ${escapeValue(request.status)}
                                </strong>
                                <br>
                                ${escapeValue(request.description)}
                                <br>
                                <small>
                                    Date Requested:
                                    ${escapeValue(request.requested)}
                                </small>
                            </div>
                        `)
                        .join("")}
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
        if (typeof requireAdminPassword === "function") {
            requireAdminPassword("delete this special request").then(allowed => {
                if (allowed && confirm("Delete this special request?")) {
                    saveRequests(
                        getRequests().filter(request => request.id !== id)
                    );

                    renderRequests();
                }
            });

            return;
        }

        if (confirm("Delete this special request?")) {
            saveRequests(
                getRequests().filter(request => request.id !== id)
            );

            renderRequests();
        }
    }

    document.addEventListener(
        "DOMContentLoaded",
        createSpecialRequestInterface
    );
})();
