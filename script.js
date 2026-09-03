const supabaseClient = window.supabaseClient;

const TABLES = {
    orders: "work_orders",
    assets: "assets",
    pms: "pms_tasks",
    projects: "projects",
    vendors: "vendors"
};

const cache = {
    orders: [],
    assets: [],
    pms: [],
    projects: [],
    vendors: []
};

let passwordResolver = null;

const getElement = id => document.getElementById(id);

function getToday() {
    return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function openModal(id) {
    getElement(id)?.classList.add("open");
}

function closeModal(id) {
    getElement(id)?.classList.remove("open");

    if (id === "admin-password-modal" && passwordResolver) {
        passwordResolver(false);
        passwordResolver = null;
    }
}

function getStatusBadge(status) {
    let className = "pending";

    if (
        status === "Done" ||
        status === "Completed" ||
        status === "Operational" ||
        status === "Primary Vendor"
    ) {
        className = "completed";
    } else if (status === "In Progress") {
        className = "progress";
    } else if (status === "Out of Service") {
        className = "cancelled";
    }

    return `
        <span class="status-badge ${className}">
            ${escapeHtml(status)}
        </span>
    `;
}

async function getCurrentUser() {
    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    return user;
}

async function requireLogin() {
    const user = await getCurrentUser();

    if (!user) {
        alert("Please log in first.");
        return null;
    }

    return user;
}

async function loadTable(key) {
    const { data, error } = await supabaseClient
        .from(TABLES[key])
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(`Unable to load ${key}:`, error);
        alert(`Unable to load ${key}. Check your Supabase table and policies.`);
        cache[key] = [];
        return [];
    }

    cache[key] = data || [];
    return cache[key];
}

async function loadAllData() {
    await Promise.all(
        Object.keys(TABLES).map(key => loadTable(key))
    );
}

async function saveRecord(key, record, originalId = "", reload = true) {
    const user = await requireLogin();

    if (!user) {
        return false;
    }

    const recordToSave = {
        ...record,
        user_id: user.id,
        updated_at: new Date().toISOString()
    };

    let result;

    if (originalId) {
        result = await supabaseClient
            .from(TABLES[key])
            .update(recordToSave)
            .eq("id", originalId);
    } else {
        result = await supabaseClient
            .from(TABLES[key])
            .insert(recordToSave);
    }

    if (result.error) {
        console.error(result.error);
        alert(result.error.message);
        return false;
    }

    if (reload) {
        await loadTable(key);
    }

    return true;
}

async function deleteRecord(key, id) {
    const user = await requireLogin();

    if (!user) {
        return false;
    }

    const { error } = await supabaseClient
        .from(TABLES[key])
        .delete()
        .eq("id", id);

    if (error) {
        console.error(error);
        alert(error.message);
        return false;
    }

    await loadTable(key);
    return true;
}

function createId(prefix, rows, digits = 5, startingNumber = 0) {
    const numbers = rows
        .map(row => {
            const match = String(row.id || "")
                .match(new RegExp(`^${prefix}(\\d+)$`));

            return match ? Number(match[1]) : startingNumber;
        });

    const nextNumber = Math.max(startingNumber, ...numbers) + 1;

    return `${prefix}${String(nextNumber).padStart(digits, "0")}`;
}

function createWorkOrderId() {
    return createId("WO-", cache.orders, 5, 0);
}

function createPmsId() {
    return createId("PMS-", cache.pms, 5, 0);
}

function createProjectId() {
    return createId("ARC", cache.projects, 5, 79999);
}

function createAssetTag() {
    return createId("ARCPH", cache.assets, 5, 50000);
}

function createVendorId() {
    return createId("VEN-", cache.vendors, 4, 1000);
}

function requireAdminPassword(action = "continue") {
    return new Promise(resolve => {
        passwordResolver = resolve;

        const text = getElement("password-action-text");
        const password = getElement("admin-password");
        const error = getElement("password-error");

        if (text) {
            text.textContent = `Confirm authorization to ${action}.`;
        }

        if (password) {
            password.value = "";
        }

        if (error) {
            error.style.display = "none";
        }

        openModal("admin-password-modal");

        setTimeout(() => password?.focus(), 50);
    });
}

function confirmAdminPassword(event) {
    event.preventDefault();

    const resolve = passwordResolver;
    passwordResolver = null;

    closeModal("admin-password-modal");

    if (resolve) {
        resolve(Boolean(getElement("admin-password").value));
    }
}

function updateNavigationNotifications() {
    const openOrders = cache.orders.filter(order =>
        order.status === "Pending" ||
        order.status === "In Progress"
    ).length;

    const openPms = cache.pms.filter(task =>
        task.status !== "Done"
    ).length;

    const counts = {
        "dashboard-count": openOrders + openPms,
        "projects-count": cache.projects.filter(project =>
            ["Planned", "In Progress", "On Hold"].includes(project.status)
        ).length,
        "assets-count": cache.assets.filter(asset =>
            ["Attention Needed", "Out of Service"].includes(asset.status)
        ).length,
        "vendors-count": cache.vendors.filter(vendor =>
            vendor.status === "Inactive"
        ).length
    };

    const submenuTargets = {
        "pms-view": openPms,
        "work-orders-view": openOrders
    };

    Object.entries(submenuTargets).forEach(([target, count]) => {
        const menuItem = document.querySelector(
            `.submenu li[data-target="${target}"]`
        );

        if (!menuItem) {
            return;
        }

        let counter = menuItem.querySelector(".nav-count");

        if (!counter) {
            counter = document.createElement("span");
            counter.className = "nav-count";
            menuItem.appendChild(counter);
        }

        counter.textContent = count;
        counter.classList.toggle("visible", count > 0);
    });

    Object.entries(counts).forEach(([id, count]) => {
        const element = getElement(id);

        if (element) {
            element.textContent = count;
            element.classList.toggle("visible", count > 0);
        }
    });
}

function setupFacilitiesSubmenuViews() {
    if (getElement("pms-view")) {
        return;
    }

    const dashboard = getElement("dashboard-view");
    const projects = getElement("projects-view");
    const main = document.querySelector(".main-content");

    const calendarPanel = dashboard
        ?.querySelector(".calendar-toolbar")
        ?.closest(".panel");

    const workspace = dashboard?.querySelector(".workspace");

    if (!calendarPanel || !workspace || !main || !projects) {
        return;
    }

    const pmsView = document.createElement("div");
    pmsView.id = "pms-view";
    pmsView.className = "view-section";
    pmsView.appendChild(calendarPanel);

    const ordersView = document.createElement("div");
    ordersView.id = "work-orders-view";
    ordersView.className = "view-section";
    ordersView.appendChild(workspace);

    main.insertBefore(pmsView, projects);
    main.insertBefore(ordersView, projects);
}

function setupNavigation() {
    document
        .querySelectorAll(".sidebar-menu li[data-target]")
        .forEach(item => {
            item.onclick = event => {
                event.stopPropagation();

                document
                    .querySelectorAll(".sidebar-menu [data-target], .view-section")
                    .forEach(element => element.classList.remove("active"));

                item.classList.add("active");

                const target = getElement(item.dataset.target);

                if (target) {
                    target.classList.add("active");
                }

                const title = [...item.childNodes]
                    .filter(node => node.nodeType === Node.TEXT_NODE)
                    .map(node => node.textContent.trim())
                    .join(" ")
                    .trim();

                if (title) {
                    getElement("page-title").textContent = title;
                }

                if (item.dataset.target === "pms-view") {
                    renderCalendar();
                }
            };
        });

    const facilitiesMenu = document.querySelector(".has-submenu");
    const facilitiesLabel = facilitiesMenu?.querySelector(".menu-label");
    const submenu = facilitiesMenu?.querySelector(".submenu");

    facilitiesLabel?.addEventListener("click", event => {
        event.stopPropagation();

        document
            .querySelectorAll(".sidebar-menu [data-target], .view-section")
            .forEach(element => element.classList.remove("active"));

        facilitiesMenu.classList.add("active");
        getElement("dashboard-view")?.classList.add("active");
        submenu?.classList.remove("is-hidden");
        getElement("page-title").textContent = "Facilities Management";
    });
}

async function handleLogin(event) {
    event.preventDefault();

    const email = getElement("login-username").value.trim();
    const password = getElement("login-password").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error || !data.user) {
        getElement("login-error").textContent =
            error?.message || "Invalid email or password.";
        getElement("login-error").classList.add("visible");
        getElement("login-password").select();
        return;
    }

    sessionStorage.setItem("fms_logged_in", "true");
    sessionStorage.setItem("fms_current_user", data.user.email || email);
    sessionStorage.setItem("fms_current_role", "Administrator");

    showApplication();
    await initializeData();
}

async function logout() {
    await supabaseClient.auth.signOut();

    sessionStorage.clear();

    getElement("login-screen")?.classList.remove("hidden");
    getElement("login-screen").style.display = "flex";
    document.querySelector(".sidebar").style.display = "none";
    document.querySelector(".main-content").style.display = "none";
}

function showApplication() {
    getElement("login-screen")?.classList.add("hidden");

    const sidebar = document.querySelector(".sidebar");
    const main = document.querySelector(".main-content");

    if (sidebar) {
        sidebar.style.display = "";
    }

    if (main) {
        main.style.display = "";
    }

    getElement("login-error")?.classList.remove("visible");
}

async function addOrder(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector(
        'button[type="submit"], button:not([type])'
    );

    if (submitButton?.disabled) {
        return;
    }

    const order = {
        id: createWorkOrderId(),
        location: getElement("location").value.trim(),
        category: getElement("category").value,
        priority: getElement("priority").value,
        description: getElement("description").value.trim(),
        reported: getElement("date-reported").value,
        completed: null,
        status: "Pending"
    };

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
    }

    form.closest(".modal")?.classList.remove("open");

    try {
        const saved = await saveRecord("orders", order, "", false);

        if (!saved) {
            return;
        }

        form.reset();
        getElement("date-reported").value = getToday();

        // Refresh only work orders so the form is immediately reusable.
        await loadTable("orders");
        renderOrders();
        updateNavigationNotifications();
    } catch (error) {
        console.error("Unable to save work order:", error);
        alert("Unable to save the work order. Please try again.");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Dispatch";
        }
    }
}

function renderOrders() {
    const body = document.querySelector("#work-orders-table tbody");

    if (!body) {
        return;
    }

    const search = (
        getElement("order-search")?.value || ""
    ).toLowerCase();

    body.textContent = "";

    const matchingOrders = cache.orders.filter(order =>
    Object.values(order)
        .join(" ")
        .toLowerCase()
        .includes(search)
);

const ordersToDisplay = search
    ? matchingOrders
    : matchingOrders.slice(0, 10);

ordersToDisplay.forEach(order => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHtml(order.id)}</td>
            <td>${escapeHtml(order.location)}</td>
            <td>${escapeHtml(order.category)}</td>
            <td>${escapeHtml(order.priority)}</td>
            <td>${escapeHtml(order.description)}</td>
            <td>${escapeHtml(order.reported)}</td>
            <td>${escapeHtml(order.completed || "")}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td>
                <button class="btn-action btn-primary order-edit"
                    data-id="${escapeHtml(order.id)}">
                    Edit
                </button>
                <button class="btn-action btn-danger order-delete"
                    data-id="${escapeHtml(order.id)}">
                    Delete
                </button>
            </td>
        `;

        body.appendChild(row);
    });

    body.querySelectorAll(".order-edit").forEach(button => {
        button.onclick = () => editWorkOrder(button.dataset.id);
    });

    body.querySelectorAll(".order-delete").forEach(button => {
        button.onclick = async () => {
            const authorized = await requireAdminPassword(
                "delete this work order"
            );

            if (
                authorized &&
                confirm("Delete this maintenance work order?")
            ) {
                await deleteRecord("orders", button.dataset.id);
                await renderAll();
            }
        };
    });
}

function createWorkOrderEditModal() {
    if (getElement("work-order-edit-modal")) {
        return;
    }

    const modal = document.createElement("div");
    modal.id = "work-order-edit-modal";
    modal.className = "modal";

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Work Order</h2>
                <button type="button" class="modal-close">&times;</button>
            </div>

            <form id="work-order-edit-form">
                <input type="hidden" id="edit-order-id">

                <div class="form-group">
                    <label>Location / Building Zone</label>
                    <input id="edit-order-location" required>
                </div>

                <div class="form-group">
                    <label>Category</label>
                    <select id="edit-order-category" required>
                        <option>HVAC</option>
                        <option>Plumbing</option>
                        <option>Electrical</option>
                        <option>Structural</option>
                        <option>Janitorial</option>
                        <option>Other Office Equipment</option>
                        <option>System Furniture</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Priority</label>
                    <select id="edit-order-priority" required>
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Description</label>
                    <textarea id="edit-order-description" required></textarea>
                </div>

                <div class="form-group">
                    <label>Date Reported</label>
                    <input type="date" id="edit-order-reported" required>
                </div>

                <div class="form-group">
                    <label>Date Completed</label>
                    <input type="date" id="edit-order-completed">
                </div>

                <div class="form-group">
                    <label>Status</label>
                    <select id="edit-order-status" required>
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                        <option>Cancelled</option>
                    </select>
                </div>

                <button class="btn-submit">Save Work Order</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector(".modal-close").onclick = () =>
        modal.classList.remove("open");

    modal.querySelector("form").onsubmit = async event => {
        event.preventDefault();

        const id = getElement("edit-order-id").value;

        const order = {
            id,
            location: getElement("edit-order-location").value.trim(),
            category: getElement("edit-order-category").value,
            priority: getElement("edit-order-priority").value,
            description: getElement("edit-order-description").value.trim(),
            reported: getElement("edit-order-reported").value,
            completed: getElement("edit-order-completed").value || null,
            status: getElement("edit-order-status").value
        };

        if (await saveRecord("orders", order, id)) {
            modal.classList.remove("open");
            await renderAll();
        }
    };
}

function editWorkOrder(id) {
    const order = cache.orders.find(item => item.id === id);

    if (!order) {
        return;
    }

    getElement("edit-order-id").value = order.id;
    getElement("edit-order-location").value = order.location || "";
    getElement("edit-order-category").value = order.category || "";
    getElement("edit-order-priority").value = order.priority || "";
    getElement("edit-order-description").value = order.description || "";
    getElement("edit-order-reported").value = order.reported || "";
    getElement("edit-order-completed").value = order.completed || "";
    getElement("edit-order-status").value = order.status || "";

    openModal("work-order-edit-modal");
}

function renderAssets() {
    const body = document.querySelector("#assets-table tbody");
    const search = (getElement("asset-search")?.value || "").toLowerCase();

    if (!body) {
        return;
    }

    body.textContent = "";

    cache.assets
        .filter(asset =>
            Object.values(asset)
                .join(" ")
                .toLowerCase()
                .includes(search)
        )
        .forEach(asset => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHtml(asset.id)}</td>
                <td><strong>${escapeHtml(asset.name)}</strong></td>
                <td>${escapeHtml(asset.location)}</td>
                <td>${getStatusBadge(asset.status)}</td>
                <td>${escapeHtml(asset.inspected)}</td>
                <td>
                    <button class="btn-action btn-primary"
                        data-edit-asset="${escapeHtml(asset.id)}">
                        Edit
                    </button>
                    <button class="btn-action btn-danger"
                        data-delete-asset="${escapeHtml(asset.id)}">
                        Delete
                    </button>
                </td>
            `;

            body.appendChild(row);
        });

    body.querySelectorAll("[data-edit-asset]").forEach(button => {
        button.onclick = () => editAsset(button.dataset.editAsset);
    });

    body.querySelectorAll("[data-delete-asset]").forEach(button => {
        button.onclick = async () => {
            const authorized = await requireAdminPassword("delete this asset");

            if (authorized && confirm("Delete this asset?")) {
                await deleteRecord("assets", button.dataset.deleteAsset);
                await renderAll();
            }
        };
    });
}

function editAsset(id = "") {
    const asset = cache.assets.find(item => item.id === id);

    getElement("asset-modal-title").textContent =
        asset ? "Update Asset" : "Register New Asset";

    getElement("asset-id").value = asset?.id || "";
    getElement("asset-name").value = asset?.name || "";
    getElement("asset-location").value = asset?.location || "";
    getElement("asset-status").value = asset?.status || "";
    getElement("asset-inspected").value = asset?.inspected || "";

    openModal("asset-modal");
}

async function saveAsset(event) {
    event.preventDefault();

    const originalId = getElement("asset-id").value;
    const id = originalId || createAssetTag();

    const asset = {
        id,
        name: getElement("asset-name").value.trim(),
        location: getElement("asset-location").value.trim(),
        status: getElement("asset-status").value,
        inspected: getElement("asset-inspected").value
    };

    if (await saveRecord("assets", asset, originalId)) {
        closeModal("asset-modal");
        event.target.reset();
        await renderAll();
    }
}

function renderProjects() {
    const body = document.querySelector("#projects-table tbody");

    if (!body) {
        return;
    }

    body.textContent = "";

    cache.projects.forEach(project => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHtml(project.id)}</td>
            <td>${escapeHtml(project.name)}</td>
            <td>${escapeHtml(project.manager)}</td>
            <td>${escapeHtml(project.start)}</td>
            <td>${escapeHtml(project.target)}</td>
            <td>${getStatusBadge(project.status)}</td>
            <td>
                <button class="btn-action btn-primary"
                    data-edit-project="${escapeHtml(project.id)}">
                    Edit
                </button>
                <button class="btn-action btn-danger"
                    data-delete-project="${escapeHtml(project.id)}">
                    Delete
                </button>
            </td>
        `;

        body.appendChild(row);
    });

    body.querySelectorAll("[data-edit-project]").forEach(button => {
        button.onclick = () => editProject(button.dataset.editProject);
    });

    body.querySelectorAll("[data-delete-project]").forEach(button => {
        button.onclick = async () => {
            const authorized = await requireAdminPassword(
                "delete this project"
            );

            if (authorized && confirm("Delete this project?")) {
                await deleteRecord("projects", button.dataset.deleteProject);
                await renderAll();
            }
        };
    });
}

function editProject(id = "") {
    const project = cache.projects.find(item => item.id === id);

    getElement("project-id").value = project?.id || "";
    getElement("project-name").value = project?.name || "";
    getElement("project-manager").value = project?.manager || "";
    getElement("project-start").value = project?.start || "";
    getElement("project-target").value = project?.target || "";
    getElement("project-status").value = project?.status || "";

    openModal("project-modal");
}

async function saveProject(event) {
    event.preventDefault();

    const originalId = getElement("project-id").value;
    const project = {
        id: originalId || createProjectId(),
        name: getElement("project-name").value.trim(),
        manager: getElement("project-manager").value.trim(),
        start: getElement("project-start").value,
        target: getElement("project-target").value,
        status: getElement("project-status").value
    };

    if (await saveRecord("projects", project, originalId)) {
        closeModal("project-modal");
        event.target.reset();
        await renderAll();
    }
}

function renderVendors() {
    const body = document.querySelector("#vendors-table tbody");

    if (!body) {
        return;
    }

    body.textContent = "";

    cache.vendors.forEach(vendor => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHtml(vendor.id)}</td>
            <td>${escapeHtml(vendor.company)}</td>
            <td>${escapeHtml(vendor.specialization)}</td>
            <td>${escapeHtml(vendor.contact)}</td>
            <td>${escapeHtml(vendor.phone)}</td>
            <td>${getStatusBadge(vendor.status)}</td>
            <td>
                <button class="btn-action btn-primary"
                    data-edit-vendor="${escapeHtml(vendor.id)}">
                    Edit
                </button>
                <button class="btn-action btn-danger"
                    data-delete-vendor="${escapeHtml(vendor.id)}">
                    Delete
                </button>
            </td>
        `;

        body.appendChild(row);
    });

    body.querySelectorAll("[data-edit-vendor]").forEach(button => {
        button.onclick = () => editVendor(button.dataset.editVendor);
    });

    body.querySelectorAll("[data-delete-vendor]").forEach(button => {
        button.onclick = async () => {
            const authorized = await requireAdminPassword(
                "delete this vendor"
            );

            if (authorized && confirm("Delete this vendor?")) {
                await deleteRecord("vendors", button.dataset.deleteVendor);
                await renderAll();
            }
        };
    });
}

function editVendor(id = "") {
    const vendor = cache.vendors.find(item => item.id === id);

    getElement("vendor-record-id").value = vendor?.id || "";
    getElement("vendor-id").value = vendor?.id || "";
    getElement("vendor-company").value = vendor?.company || "";
    getElement("vendor-specialization").value = vendor?.specialization || "";
    getElement("vendor-contact").value = vendor?.contact || "";
    getElement("vendor-phone").value = vendor?.phone || "";
    getElement("vendor-status").value = vendor?.status || "";

    openModal("vendor-modal");
}

async function saveVendor(event) {
    event.preventDefault();

    const originalId = getElement("vendor-record-id").value;
    const id = getElement("vendor-id").value.trim() || createVendorId();

    if (
        cache.vendors.some(vendor =>
            vendor.id === id && vendor.id !== originalId
        )
    ) {
        alert("That Vendor ID is already in use.");
        return;
    }

    const vendor = {
        id,
        company: getElement("vendor-company").value.trim(),
        specialization: getElement("vendor-specialization").value.trim(),
        contact: getElement("vendor-contact").value.trim(),
        phone: getElement("vendor-phone").value.trim(),
        status: getElement("vendor-status").value
    };

    if (await saveRecord("vendors", vendor, originalId)) {
        closeModal("vendor-modal");
        event.target.reset();
        await renderAll();
    }
}

function renderCalendar() {
    const year = Number(getElement("calendar-year")?.value);
    const calendar = getElement("maintenance-calendar");

    if (!calendar || !Number.isInteger(year)) {
        return;
    }

    calendar.textContent = "";

    const firstDay = new Date(year, 0, 1);
    firstDay.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));

    const now = new Date();

    for (let index = 0; index < 52; index++) {
        const startDate = new Date(firstDay);
        startDate.setDate(firstDay.getDate() + index * 7);

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);

        const week = document.createElement("div");
        week.className = "week";

        if (startDate <= now && now <= endDate) {
            week.classList.add("current");
        }

        if (startDate > now) {
            week.classList.add("upcoming");
        }

        const tasks = cache.pms
            .filter(task => {
                const date = new Date(`${task.date}T00:00:00`);
                return date >= startDate && date <= endDate;
            })
            .map(task => `
                <div class="maintenance-dot ${task.status === "Done" ? "done" : ""}">
                    <strong>${escapeHtml(task.asset)}</strong>
                    <br>
                    ${escapeHtml(task.type)}
                    <small>
                        ${escapeHtml(task.status)} · ${escapeHtml(task.date)}
                    </small>
                    <button class="btn-action"
                        data-edit-pms="${escapeHtml(task.id)}">
                        Edit
                    </button>
                    <button class="btn-action btn-danger"
                        data-delete-pms="${escapeHtml(task.id)}">
                        Delete
                    </button>
                </div>
            `)
            .join("");

        week.innerHTML = `
            <div class="week-number">Week ${index + 1}</div>
            <div class="week-date">
                ${startDate.toLocaleDateString()} –
                ${endDate.toLocaleDateString()}
            </div>
            ${tasks}
        `;

        calendar.appendChild(week);
    }

    calendar.querySelectorAll("[data-edit-pms]").forEach(button => {
        button.onclick = () => editPms(button.dataset.editPms);
    });

    calendar.querySelectorAll("[data-delete-pms]").forEach(button => {
        button.onclick = () => deletePms(button.dataset.deletePms);
    });
}

function editPms(id = "") {
    const task = cache.pms.find(item => item.id === id);

    getElement("pms-id").value = task?.id || "";
    getElement("pms-asset").value = task?.asset || "";
    getElement("pms-location").value = task?.location || "";
    getElement("pms-type").value = task?.type || "";
    getElement("pms-date").value = task?.date || "";
    getElement("pms-status").value = task?.status || "";

    openModal("pms-modal");
}

async function savePms(event) {
    event.preventDefault();

    const originalId = getElement("pms-id").value;
    const task = {
        id: originalId || createPmsId(),
        asset: getElement("pms-asset").value.trim(),
        location: getElement("pms-location").value.trim(),
        type: getElement("pms-type").value,
        date: getElement("pms-date").value,
        status: getElement("pms-status").value
    };

    if (await saveRecord("pms", task, originalId)) {
        getElement("calendar-year").value = task.date.slice(0, 4);
        closeModal("pms-modal");
        event.target.reset();
        await renderAll();
    }
}

async function deletePms(id) {
    const authorized = await requireAdminPassword("delete this PMS task");

    if (authorized && confirm("Delete this PMS task?")) {
        await deleteRecord("pms", id);
        await renderAll();
    }
}

function getUpcomingTasks() {
    const start = new Date();
    const end = new Date();

    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 30);

    return cache.pms.filter(task => {
        const date = new Date(`${task.date}T00:00:00`);

        return (
            task.status !== "Done" &&
            date >= start &&
            date <= end
        );
    });
}

function showReminder() {
    const tasks = getUpcomingTasks();

    if (!tasks.length || getElement("reminder-modal")?.classList.contains("open")) {
        return;
    }

    getElement("reminder-list").innerHTML = tasks
        .map(task => `
            <div class="reminder-item">
                <strong>${escapeHtml(task.date)}</strong>
                <br>
                ${escapeHtml(task.asset)} — ${escapeHtml(task.type)}
                <br>
                ${escapeHtml(task.location)}
            </div>
        `)
        .join("");

    openModal("reminder-modal");
}

async function renderAll() {
    await loadAllData();

    getElement("count-assets-metric").textContent = cache.assets.length;
    getElement("count-open").textContent = cache.orders.filter(order =>
        order.status !== "Completed" &&
        order.status !== "Cancelled"
    ).length;
    getElement("count-completed").textContent = cache.orders.filter(order =>
        order.status === "Completed"
    ).length;
    getElement("count-upcoming-pms").textContent = getUpcomingTasks().length;

    renderOrders();
    renderAssets();
    renderProjects();
    renderVendors();
    renderCalendar();
    updateNavigationNotifications();
}

function excelCell(value) {
    return `<td>${escapeHtml(value)}</td>`;
}

function downloadReport(title, rows, fileName) {
    const columns = Object.keys(rows[0] || { Record: "" });

    const html = `
        <html>
            <head><meta charset="UTF-8"></head>
            <body>
                <h2>${escapeHtml(title)}</h2>
                <table border="1">
                    <tr>
                        ${columns.map(column =>
                            `<th>${escapeHtml(column)}</th>`
                        ).join("")}
                    </tr>
                    ${rows.map(row => `
                        <tr>
                            ${columns.map(column =>
                                excelCell(row[column] ?? "")
                            ).join("")}
                        </tr>
                    `).join("")}
                </table>
            </body>
        </html>
    `;

    const blob = new Blob([html], {
        type: "application/vnd.ms-excel"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}-${getToday()}.xls`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function setupEventHandlers() {
    getElement("login-form").onsubmit = handleLogin;
    getElement("facility-form").onsubmit = addOrder;
    getElement("project-form").onsubmit = saveProject;
    getElement("pms-form").onsubmit = savePms;
    getElement("vendor-form").onsubmit = saveVendor;
    getElement("asset-form").onsubmit = saveAsset;
    getElement("admin-password-form").onsubmit = confirmAdminPassword;

    getElement("date-reported").value = getToday();

    getElement("add-project").onclick = () => editProject();
    getElement("add-pms").onclick = () => editPms();
    getElement("add-vendor").onclick = () => editVendor();
    getElement("btn-add-asset").onclick = () => editAsset();

    getElement("calendar-year").onchange = renderCalendar;
    getElement("asset-search").oninput = renderAssets;
    getElement("order-search").oninput = renderOrders;
    getElement("download-report").onclick = () => {
        downloadReport(
            "Facilities Management Report",
            [
                ...cache.orders,
                ...cache.assets,
                ...cache.pms,
                ...cache.projects,
                ...cache.vendors
            ],
            "facilities-report"
        );
    };

    const reports = [
        ["download-pms-report", "PMS Calendar", "pms", "pms-calendar"],
        ["download-orders-report", "Work Orders", "orders", "work-orders"],
        ["download-projects-report", "Projects", "projects", "projects"],
        ["download-assets-report", "Assets", "assets", "assets"],
        ["download-vendors-report", "Vendors", "vendors", "vendors"]
    ];

    reports.forEach(([buttonId, title, key, fileName]) => {
        getElement(buttonId).onclick = () =>
            downloadReport(title, cache[key], fileName);
    });

    getElement("logout-button").onclick = async () => {
        if (confirm("Are you sure you want to log out?")) {
            await logout();
        }
    };

    document.querySelectorAll("[data-close]").forEach(button => {
        button.onclick = () => closeModal(button.dataset.close);
    });
}

function subscribeToChanges() {
    Object.values(TABLES).forEach(table => {
        supabaseClient
            .channel(`${table}-changes`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table
                },
                async () => {
                    await renderAll();
                }
            )
            .subscribe();
    });
}

async function initializeData() {
    setupFacilitiesSubmenuViews();
    setupNavigation();
    createWorkOrderEditModal();
    setupEventHandlers();

    await renderAll();
    showReminder();

    setTimeout(() => {
        const date = getElement("current-date");

        if (date) {
            date.textContent = new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            });
        }
    }, 100);
}

document.addEventListener("DOMContentLoaded", async () => {
    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (session) {
        sessionStorage.setItem("fms_logged_in", "true");
        sessionStorage.setItem(
            "fms_current_user",
            session.user.email || ""
        );
        sessionStorage.setItem("fms_current_role", "Administrator");

        showApplication();
        await initializeData();
    } else {
        document.querySelector(".sidebar").style.display = "none";
        document.querySelector(".main-content").style.display = "none";
    }

    supabaseClient.auth.onAuthStateChange(async (event, sessionState) => {
        if (event === "SIGNED_OUT" || !sessionState) {
            document.querySelector(".sidebar").style.display = "none";
            document.querySelector(".main-content").style.display = "none";
            getElement("login-screen")?.classList.remove("hidden");
            return;
        }

        showApplication();
    });

    subscribeToChanges();
});
