
        const STORAGE_KEYS = {
            orders: "fms_work_orders_data",
            assets: "fms_assets_data",
            pms: "fms_pms_data",
            projects: "fms_projects_data",
            vendors: "fms_vendors_data"
        };

        const ADMIN_PASSWORD = "2468";
        let passwordResolver = null;

        const defaults = {
    orders: [
        {
            id: "WO-04092",
            location: "Server Room B (HVAC)",
            category: "HVAC",
            priority: "High",
            description: "HVAC issue reported in the server room.",
            reported: "2026-08-15",
            completed: "",
            status: "In Progress"
        },
        {
            id: "WO-04093",
            location: "Floor 3 East Wing",
            category: "Electrical",
            priority: "Medium",
            description: "Electrical issue reported in the east wing.",
            reported: "2026-08-16",
            completed: "",
            status: "Pending"
        }
    ],

    assets: [
        {
            id: "AST-9021",
            name: "Carrier Industrial Chiller unit #2",
            location: "Roof Deck West",
            status: "Operational",
            inspected: "2026-08-01"
        },
        {
            id: "AST-4410",
            name: "Otis Passenger Elevator Car Lift B",
            location: "Central Core Shaft",
            status: "Attention Needed",
            inspected: "2026-08-11"
        }
    ],

    vendors: [
        {
            id: "VEN-1001",
            company: "VoltStream Electrical Group",
            specialization: "High-Voltage Panels",
            contact: "Marcus Vance",
            phone: "+1 (555) 019-3829",
            status: "Primary Vendor"
        }
    ]
};

        const getElement = id => document.getElementById(id);

        function readData(key, defaultValue = []) {
            try {
                return JSON.parse(localStorage.getItem(key)) || defaultValue;
            } catch {
                return defaultValue;
            }
        }

        function saveData(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        }

        function createId(prefix) {
            return `${prefix}${Date.now().toString().slice(-6)}`;
        }
function createPmsId() {
    const tasks = readData(STORAGE_KEYS.pms);

    const numbers = tasks
        .map(task => {
            const match = String(task.id).match(/^PMS-(\d{5})$/);
            return match ? Number(match[1]) : 0;
        });

    const highestNumber = Math.max(0, ...numbers);

    return `PMS-${String(highestNumber + 1).padStart(5, "0")}`;
}

function normalizePmsIds() {
    const tasks = readData(STORAGE_KEYS.pms);
    let nextNumber = 1;

    tasks.forEach(task => {
        task.id = `PMS-${String(nextNumber).padStart(5, "0")}`;
        nextNumber++;
    });

    saveData(STORAGE_KEYS.pms, tasks);
}
      function createWorkOrderId() {
    const orders = readData(STORAGE_KEYS.orders);
  
    const numbers = orders
        .map(order => {
            const match = String(order.id).match(/^WO-?(\d{5})$/);
            return match ? Number(match[1]) : 0;
        });

    const highestNumber = Math.max(0, ...numbers);

    return `WO-${String(highestNumber + 1).padStart(5, "0")}`;
}
  
function createAssetTag() {
    const assets = readData(STORAGE_KEYS.assets);

    const numbers = assets
        .map(asset => {
            const match = String(asset.id).match(/^ARCPH(5\d{4})$/);
            return match ? Number(match[1]) : 50000;
        });

    const highestNumber = Math.max(50000, ...numbers);

    return `ARCPH${String(highestNumber + 1).padStart(5, "0")}`;
}

function createProjectId() {
    const projects = readData(STORAGE_KEYS.projects);

    const numbers = projects
        .map(project => {
            const match = String(project.id).match(/^ARCPH(8\d{4})$/);
            return match ? Number(match[1]) : 79999;
        });

    const highestNumber = Math.max(79999, ...numbers);

    return `ARC${String(highestNumber + 1).padStart(5, "0")}`;
}

        function getToday() {
            return new Date().toISOString().slice(0, 10);
        }

        function escapeHtml(value) {
            const element = document.createElement("div");
            element.textContent = value ?? "";
            return element.innerHTML;
        }

        function openModal(id) {
            getElement(id).classList.add("open");
        }

        function closeModal(id) {
            getElement(id).classList.remove("open");

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

        function requireAdminPassword(action = "delete this record") {
            return new Promise(resolve => {
                passwordResolver = resolve;

                getElement("password-action-text").textContent =
                    `Enter the administrator password to ${action}.`;

                getElement("admin-password").value = "";
                getElement("password-error").style.display = "none";

                openModal("admin-password-modal");

                setTimeout(() => {
                    getElement("admin-password").focus();
                }, 50);
            });
        }

        function updateNavigationNotifications() {
    const orders = readData(STORAGE_KEYS.orders);
    const pmsTasks = readData(STORAGE_KEYS.pms);

    const openWorkOrders = orders.filter(order =>
        order.status === "Pending" ||
        order.status === "In Progress"
    ).length;

    const openPmsTasks = pmsTasks.filter(task =>
        task.status !== "Done"
    ).length;

    const counts = {
        "dashboard-count": openPmsTasks + openWorkOrders,
        "pms-count": openPmsTasks,
        "work-orders-count": openWorkOrders,

        "projects-count": readData(STORAGE_KEYS.projects)
            .filter(project =>
                project.status === "Planned" ||
                project.status === "In Progress" ||
                project.status === "On Hold"
            ).length,

        "assets-count": readData(STORAGE_KEYS.assets)
            .filter(asset =>
                asset.status === "Attention Needed" ||
                asset.status === "Out of Service"
            ).length,

        "vendors-count": readData(STORAGE_KEYS.vendors)
            .filter(vendor => vendor.status === "Inactive")
            .length
    };

    const submenuTargets = {
        "pms-view": "pms-count",
        "work-orders-view": "work-orders-count"
    };

    Object.entries(submenuTargets).forEach(([target, elementId]) => {
        const menuItem = document.querySelector(
            `.submenu li[data-target="${target}"]`
        );

        if (!menuItem) {
            return;
        }

        let counter = getElement(elementId);

        if (!counter) {
            counter = document.createElement("span");
            counter.id = elementId;
            counter.className = "nav-count";
            menuItem.appendChild(counter);
        }

        const count = counts[elementId];
        counter.textContent = count;
        counter.classList.toggle("visible", count > 0);
    });

    Object.entries(counts).forEach(([elementId, count]) => {
        const element = getElement(elementId);

        if (!element) {
            return;
        }

        element.textContent = count;
        element.classList.toggle("visible", count > 0);
    });
}
        function initializeApplication() {
    Object.entries(defaults).forEach(([key, value]) => {
        if (!localStorage.getItem(STORAGE_KEYS[key])) {
            saveData(STORAGE_KEYS[key], value);
        }
    });

            if (!localStorage.getItem(STORAGE_KEYS.pms)) {
        const pmsTasks = readData(STORAGE_KEYS.assets).map((asset, index) => ({
            id: createPmsId(),
            asset: asset.name,
            location: asset.location,
            type: "Routine service",
            date: getToday(),
            status: index ? "In Progress" : "Done"
        }));

        saveData(STORAGE_KEYS.pms, pmsTasks);
    }

    normalizePmsIds();

    if (sessionStorage.getItem("fms_logged_in") === "true") {
        getElement("login-screen").classList.add("hidden");
    }

    setupFacilitiesSubmenuViews();
    setupEventHandlers();
    renderAll();
    showReminder();

    setTimeout(showWorkOrderReminder, 300);
}

function setupFacilitiesSubmenuViews() {
    const dashboardView = getElement("dashboard-view");
    const calendarPanel = dashboardView
        .querySelector(".calendar-toolbar")
        .closest(".panel");
    const workspace = dashboardView.querySelector(".workspace");
    const projectsView = getElement("projects-view");
    const mainContent = document.querySelector(".main-content");

    const pmsView = document.createElement("div");
    pmsView.id = "pms-view";
    pmsView.className = "view-section";
    pmsView.appendChild(calendarPanel);

    const workOrdersView = document.createElement("div");
    workOrdersView.id = "work-orders-view";
    workOrdersView.className = "view-section";
    workOrdersView.appendChild(workspace);

    mainContent.insertBefore(pmsView, projectsView);
    mainContent.insertBefore(workOrdersView, projectsView);
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

            getElement("download-report").onclick = downloadAllReport;
            getElement("download-pms-report").onclick = () =>
                downloadReport(
                    "52-Week PMS Calendar",
                    readData(STORAGE_KEYS.pms),
                    "pms-calendar"
                );

            getElement("download-orders-report").onclick = () =>
                downloadReport(
                    "Active Maintenance Work Orders",
                    readData(STORAGE_KEYS.orders),
                    "maintenance-work-orders"
                );

            getElement("download-projects-report").onclick = () =>
                downloadReport(
                    "Project Management",
                    readData(STORAGE_KEYS.projects),
                    "projects"
                );

            getElement("download-assets-report").onclick = () =>
                downloadReport(
                    "Asset Tracking",
                    readData(STORAGE_KEYS.assets),
                    "assets"
                );

            getElement("download-vendors-report").onclick = () =>
                downloadReport(
                    "Vendor Directory",
                    readData(STORAGE_KEYS.vendors),
                    "vendors"
                );

                       document.querySelectorAll(".sidebar-menu li[data-target]").forEach(item => {
                item.onclick = event => {
                    event.stopPropagation();

                    const facilitiesMenu = document.querySelector(".has-submenu");
                    const isFacilitiesSubmenuItem =
                        item.closest(".submenu") !== null;

                    if (!isFacilitiesSubmenuItem) {
                        facilitiesMenu?.classList.remove("active");
                        document.querySelectorAll(".submenu").forEach(submenu => {
                            submenu.classList.add("is-hidden");
                        });
                    }

                    document
                        .querySelectorAll(".sidebar-menu [data-target], .view-section")
                        .forEach(element => element.classList.remove("active"));

                    item.classList.add("active");

                    const targetView = getElement(item.dataset.target);

                    if (targetView) {
                        targetView.classList.add("active");
                    }

                    const menuTitle = [...item.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent.trim())
    .join(" ")
    .trim();

getElement("page-title").textContent = menuTitle;
                };
            });

            const facilitiesMenu = document.querySelector(".has-submenu");
            const facilitiesLabel = facilitiesMenu?.querySelector(".menu-label");
            const facilitiesSubmenu = facilitiesMenu?.querySelector(".submenu");

            if (facilitiesLabel) {
                facilitiesLabel.onclick = event => {
                    event.stopPropagation();

                    document
                        .querySelectorAll(".sidebar-menu [data-target], .view-section")
                        .forEach(element => element.classList.remove("active"));

                    document.querySelectorAll(".sidebar-menu li").forEach(item => {
                        item.classList.remove("active");
                    });

                    facilitiesMenu.classList.add("active");
                    getElement("dashboard-view").classList.add("active");

                    facilitiesSubmenu?.classList.remove("is-hidden");
                    getElement("page-title").textContent =
                        "Facilities Management";
                };
            }
            document.querySelectorAll("[data-close]").forEach(button => {
                button.onclick = () => closeModal(button.dataset.close);
            });

            getElement("current-date").textContent =
                new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                });

            const currentYear = new Date().getFullYear();

            [currentYear, currentYear + 1].forEach(year => {
               
            });
        }

        function handleLogin(event) {
            event.preventDefault();

            const username = getElement("login-username").value.trim();
            const password = getElement("login-password").value;

            if (username === "admin" && password === ADMIN_PASSWORD) {
                sessionStorage.setItem("fms_logged_in", "true");
                getElement("login-screen").classList.add("hidden");
                getElement("login-error").classList.remove("visible");
            } else {
                getElement("login-error").classList.add("visible");
                getElement("login-password").select();
            }
        }

        function confirmAdminPassword(event) {
            event.preventDefault();

            const password = getElement("admin-password").value;

            if (password !== ADMIN_PASSWORD) {
                getElement("password-error").style.display = "block";
                getElement("admin-password").select();
                return;
            }

            const resolve = passwordResolver;

            passwordResolver = null;
            closeModal("admin-password-modal");

            if (resolve) {
                resolve(true);
            }
        }

        function addOrder(event) {
    event.preventDefault();

    const orders = readData(STORAGE_KEYS.orders);

    orders.unshift({
        id: createWorkOrderId(),
        location: getElement("location").value,
        category: getElement("category").value,
        priority: getElement("priority").value,
        reported: getElement("date-reported").value,
        completed: "",
        status: "Pending"
    });

    saveData(STORAGE_KEYS.orders, orders);
    event.target.reset();
    getElement("date-reported").value = getToday();
    renderAll();
}

        function renderAll() {
            const orders = readData(STORAGE_KEYS.orders);
            const assets = readData(STORAGE_KEYS.assets);

            getElement("count-assets-metric").textContent = assets.length;

            getElement("count-open").textContent =
                orders.filter(order => order.status !== "Completed").length;

            getElement("count-completed").textContent =
                orders.filter(order => order.status === "Completed").length;

            getElement("count-upcoming-pms").textContent = getUpcomingTasks().length;

            renderOrders();
            renderAssets();
            renderProjects();
            renderVendors();
            renderCalendar();
            updateNavigationNotifications();
        }

       function renderOrders() {
    const tableBody = document.querySelector("#work-orders-table tbody");
    const orders = readData(STORAGE_KEYS.orders);

    tableBody.textContent = "";

    orders.forEach(order => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHtml(order.id)}</td>
            <td>${escapeHtml(order.location)}</td>
            <td>${escapeHtml(order.category)}</td>
            <td>${escapeHtml(order.priority)}</td>
            <td>${escapeHtml(order.reported || "")}</td>
            <td>
                <input
                    type="date"
                    class="order-completed"
                    data-id="${escapeHtml(order.id)}"
                    value="${escapeHtml(order.completed || "")}"
                >
            </td>
            <td>${getStatusBadge(order.status)}</td>
            <td>
                <select class="order-status" data-id="${escapeHtml(order.id)}">
                    <option ${order.status === "Pending" ? "selected" : ""}>Pending</option>
                    <option ${order.status === "In Progress" ? "selected" : ""}>In Progress</option>
                    <option ${order.status === "Completed" ? "selected" : ""}>Completed</option>
                    <option ${order.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
                </select>

                <button
                    class="btn-action btn-danger order-delete"
                    data-id="${escapeHtml(order.id)}"
                >
                    Delete
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll(".order-completed").forEach(input => {
        input.onchange = () => {
            const updatedOrders = readData(STORAGE_KEYS.orders);
            const order = updatedOrders.find(item => item.id === input.dataset.id);

            if (order) {
                order.completed = input.value;
                saveData(STORAGE_KEYS.orders, updatedOrders);
                renderAll();
            }
        };
    });

    tableBody.querySelectorAll(".order-status").forEach(select => {
        select.onchange = () => {
            const updatedOrders = readData(STORAGE_KEYS.orders);
            const order = updatedOrders.find(item => item.id === select.dataset.id);

            if (order) {
                order.status = select.value;
                saveData(STORAGE_KEYS.orders, updatedOrders);
                renderAll();
            }
        };
    });

    tableBody.querySelectorAll(".order-delete").forEach(button => {
        button.onclick = async () => {
            const isAuthorized = await requireAdminPassword(
                "delete this work order"
            );

            if (isAuthorized && confirm("Delete this maintenance work order?")) {
                const remainingOrders = readData(STORAGE_KEYS.orders)
                    .filter(order => order.id !== button.dataset.id);

                saveData(STORAGE_KEYS.orders, remainingOrders);
                renderAll();
            }
        };
    });
}

        function renderAssets() {
            const searchTerm = getElement("asset-search").value.toLowerCase();
            const tableBody = document.querySelector("#assets-table tbody");

            tableBody.textContent = "";

            readData(STORAGE_KEYS.assets)
                .filter(asset =>
                    Object.values(asset)
                        .join(" ")
                        .toLowerCase()
                        .includes(searchTerm)
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
                            <button
                                class="btn-action btn-primary"
                                data-edit="${escapeHtml(asset.id)}"
                            >
                                Edit
                            </button>

                            <button
                                class="btn-action btn-danger"
                                data-del="${escapeHtml(asset.id)}"
                            >
                                Delete
                            </button>
                        </td>
                    `;

                    tableBody.appendChild(row);
                });

            tableBody.querySelectorAll("[data-edit]").forEach(button => {
                button.onclick = () => editAsset(button.dataset.edit);
            });

            tableBody.querySelectorAll("[data-del]").forEach(button => {
                button.onclick = async () => {
                    const isAuthorized = await requireAdminPassword(
                        "delete this asset"
                    );

                    if (isAuthorized && confirm("Delete this asset?")) {
                        const remainingAssets = readData(STORAGE_KEYS.assets)
                            .filter(asset => asset.id !== button.dataset.del);

                        saveData(STORAGE_KEYS.assets, remainingAssets);
                        renderAll();
                    }
                };
            });
        }

        function renderProjects() {
            const tableBody = document.querySelector("#projects-table tbody");

            tableBody.textContent = "";

            readData(STORAGE_KEYS.projects).forEach(project => {
                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${escapeHtml(project.id)}</td>
                    <td>${escapeHtml(project.name)}</td>
                    <td>${escapeHtml(project.manager)}</td>
                    <td>${escapeHtml(project.start)}</td>
                    <td>${escapeHtml(project.target)}</td>
                    <td>${getStatusBadge(project.status)}</td>
                    <td>
                        <button
                            class="btn-action btn-primary"
                            data-edit-project="${escapeHtml(project.id)}"
                        >
                            Edit
                        </button>

                        <button
                            class="btn-action btn-danger"
                            data-delete-project="${escapeHtml(project.id)}"
                        >
                            Delete
                        </button>
                    </td>
                `;

                tableBody.appendChild(row);
            });

            tableBody.querySelectorAll("[data-edit-project]").forEach(button => {
                button.onclick = () => editProject(button.dataset.editProject);
            });

            tableBody.querySelectorAll("[data-delete-project]").forEach(button => {
                button.onclick = async () => {
                    const isAuthorized = await requireAdminPassword(
                        "delete this project"
                    );

                    if (isAuthorized && confirm("Delete this project?")) {
                        const remainingProjects = readData(STORAGE_KEYS.projects)
                            .filter(project =>
                                project.id !== button.dataset.deleteProject
                            );

                        saveData(STORAGE_KEYS.projects, remainingProjects);
                        renderAll();
                    }
                };
            });
        }

        function renderVendors() {
            const tableBody = document.querySelector("#vendors-table tbody");

            tableBody.textContent = "";

            readData(STORAGE_KEYS.vendors).forEach(vendor => {
                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${escapeHtml(vendor.id)}</td>
                    <td>${escapeHtml(vendor.company)}</td>
                    <td>${escapeHtml(vendor.specialization)}</td>
                    <td>${escapeHtml(vendor.contact)}</td>
                    <td>${escapeHtml(vendor.phone)}</td>
                    <td>${getStatusBadge(vendor.status)}</td>
                    <td>
                        <button
                            class="btn-action btn-primary"
                            data-edit-vendor="${escapeHtml(vendor.id)}"
                        >
                            Edit
                        </button>

                        <button
                            class="btn-action btn-danger"
                            data-delete-vendor="${escapeHtml(vendor.id)}"
                        >
                            Delete
                        </button>
                    </td>
                `;

                tableBody.appendChild(row);
            });

            tableBody.querySelectorAll("[data-edit-vendor]").forEach(button => {
                button.onclick = () => editVendor(button.dataset.editVendor);
            });

            tableBody.querySelectorAll("[data-delete-vendor]").forEach(button => {
                button.onclick = async () => {
                    const isAuthorized = await requireAdminPassword(
                        "delete this vendor"
                    );

                    if (isAuthorized && confirm("Delete this vendor?")) {
                        const remainingVendors = readData(STORAGE_KEYS.vendors)
                            .filter(vendor =>
                                vendor.id !== button.dataset.deleteVendor
                            );

                        saveData(STORAGE_KEYS.vendors, remainingVendors);
                        renderAll();
                    }
                };
            });
        }
        
        function editVendor(id = "") {
    const vendor = readData(STORAGE_KEYS.vendors)
        .find(item => item.id === id);

    getElement("vendor-record-id").value = vendor?.id || "";
    getElement("vendor-id").value = vendor?.id || "";
    getElement("vendor-company").value = vendor?.company || "";
    getElement("vendor-specialization").value =
        vendor?.specialization || "";
    getElement("vendor-contact").value = vendor?.contact || "";
    getElement("vendor-phone").value = vendor?.phone || "";
    getElement("vendor-status").value =
        vendor?.status || "";

    openModal("vendor-modal");
}

function saveVendor(event) {
    event.preventDefault();

    const vendors = readData(STORAGE_KEYS.vendors);
    const originalId = getElement("vendor-record-id").value;
    const vendorId = getElement("vendor-id").value.trim();

    if (
        vendors.some(vendor =>
            vendor.id === vendorId && vendor.id !== originalId
        )
    ) {
        alert("That Vendor ID is already in use.");
        getElement("vendor-id").focus();
        return;
    }

    const vendor = {
        id: vendorId || createId("VEN-"),
        company: getElement("vendor-company").value.trim(),
        specialization: getElement("vendor-specialization").value.trim(),
        contact: getElement("vendor-contact").value.trim(),
        phone: getElement("vendor-phone").value.trim(),
        status: getElement("vendor-status").value
    };

    const index = vendors.findIndex(item => item.id === originalId);

    if (index === -1) {
        vendors.push(vendor);
    } else {
        vendors[index] = vendor;
    }

    saveData(STORAGE_KEYS.vendors, vendors);
    closeModal("vendor-modal");
    event.target.reset();
    renderAll();
}

        function renderCalendar() {
            const year = Number(getElement("calendar-year").value);
            const calendar = getElement("maintenance-calendar");

            calendar.textContent = "";

            const firstDay = new Date(year, 0, 1);
            firstDay.setDate(
                firstDay.getDate() -
                ((firstDay.getDay() + 6) % 7)
            );

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

                const tasks = readData(STORAGE_KEYS.pms)
                    .filter(task => {
                        const taskDate = new Date(task.date);

                        return taskDate >= startDate && taskDate <= endDate;
                    })
                    .map(task => `
                        <div class="maintenance-dot ${task.status === "Done" ? "done" : ""}">
                            <strong>${escapeHtml(task.asset)}</strong>
                            <br>
                            ${escapeHtml(task.type)}

                            <small>
                                ${escapeHtml(task.status)} ·
                                ${escapeHtml(task.date)}
                            </small>

                            <button
                                class="btn-action"
                                data-edit-pms="${escapeHtml(task.id)}"
                            >
                                Edit
                            </button>

                            <button
                                class="btn-action btn-danger"
                                data-delete-pms="${escapeHtml(task.id)}"
                            >
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

        function getUpcomingTasks() {
            const startDate = new Date();
            const endDate = new Date();

            startDate.setHours(0, 0, 0, 0);
            endDate.setDate(startDate.getDate() + 30);

            return readData(STORAGE_KEYS.pms).filter(task => {
                const taskDate = new Date(task.date);

                return (
                    task.status !== "Done" &&
                    taskDate >= startDate &&
                    taskDate <= endDate
                );
            });
        }

        function showReminder() {
            const tasks = getUpcomingTasks();

            if (!tasks.length) {
                return;
            }

            getElement("reminder-list").innerHTML = tasks
                .map(task => `
                    <div class="reminder-item">
                        <strong>${escapeHtml(task.date)}</strong>
                        <br>
                        ${escapeHtml(task.asset)} —
                        ${escapeHtml(task.type)}
                        <br>
                        ${escapeHtml(task.location)}
                    </div>
                `)
                .join("");

            openModal("reminder-modal");
        }

        async function deletePms(id) {
            const isAuthorized = await requireAdminPassword(
                "delete this PMS task"
            );

            if (isAuthorized && confirm("Delete this PMS task?")) {
                const remainingTasks = readData(STORAGE_KEYS.pms)
                    .filter(task => task.id !== id);

                saveData(STORAGE_KEYS.pms, remainingTasks);
                renderAll();
            }
        }

        function editPms(id = "") {
            const task = readData(STORAGE_KEYS.pms)
                .find(item => item.id === id);

            getElement("pms-id").value = task?.id || "";
            getElement("pms-asset").value = task?.asset || "";
            getElement("pms-location").value = task?.location || "";
            getElement("pms-type").value = task?.type || "";
            getElement("pms-date").value = task?.date || "";
            getElement("pms-status").value = task?.status || "";

            openModal("pms-modal");
        }

        function savePms(event) {
    event.preventDefault();

    const tasks = readData(STORAGE_KEYS.pms);
    const taskDate = getElement("pms-date").value;

    const task = {
        id: getElement("pms-id").value || createPmsId(),
        asset: getElement("pms-asset").value.trim(),
        location: getElement("pms-location").value.trim(),
        type: getElement("pms-type").value,
        date: taskDate,
        status: getElement("pms-status").value
    };

    const index = tasks.findIndex(item => item.id === task.id);

    if (index === -1) {
        tasks.push(task);
    } else {
        tasks[index] = task;
    }

    saveData(STORAGE_KEYS.pms, tasks);

    const taskYear = taskDate.slice(0, 4);
    const yearSelect = getElement("calendar-year");

    yearSelect.value = taskYear;

    closeModal("pms-modal");
    event.target.reset();
    renderAll();
}

        function editProject(id = "") {
            const project = readData(STORAGE_KEYS.projects)
                .find(item => item.id === id);

            getElement("project-id").value = project?.id || "";
            getElement("project-name").value = project?.name || "";
            getElement("project-manager").value = project?.manager || "";
            getElement("project-start").value = project?.start || "";
            getElement("project-target").value = project?.target || "";
            getElement("project-status").value = project?.status || "";

            openModal("project-modal");
        }

        function saveProject(event) {
    event.preventDefault();

    const projects = readData(STORAGE_KEYS.projects);

    const project = {
        id: getElement("project-id").value || createProjectId(),
        name: getElement("project-name").value,
        manager: getElement("project-manager").value,
        start: getElement("project-start").value,
        target: getElement("project-target").value,
        status: getElement("project-status").value
    };

    const index = projects.findIndex(item => item.id === project.id);

    if (index < 0) {
        projects.push(project);
    } else {
        projects[index] = project;
    }

    saveData(STORAGE_KEYS.projects, projects);
    closeModal("project-modal");
    event.target.reset();
    renderAll();
}

        function editVendor(id = "") {
            const vendor = readData(STORAGE_KEYS.vendors)
                .find(item => item.id === id);

            getElement("vendor-id").value = vendor?.id || "";
            getElement("vendor-company").value = vendor?.company || "";
            getElement("vendor-specialization").value =
                vendor?.specialization || "";
            getElement("vendor-contact").value = vendor?.contact || "";
            getElement("vendor-phone").value = vendor?.phone || "";
            getElement("vendor-status").value =
                vendor?.status || "";

            openModal("vendor-modal");
        }

        function saveVendor(event) {
            event.preventDefault();

            const vendors = readData(STORAGE_KEYS.vendors);

            const vendor = {
                id: getElement("vendor-id").value || createId("VEN-"),
                company: getElement("vendor-company").value,
                specialization: getElement("vendor-specialization").value,
                contact: getElement("vendor-contact").value,
                phone: getElement("vendor-phone").value,
                status: getElement("vendor-status").value
            };

            const index = vendors.findIndex(item => item.id === vendor.id);

            if (index < 0) {
                vendors.push(vendor);
            } else {
                vendors[index] = vendor;
            }

            saveData(STORAGE_KEYS.vendors, vendors);
            closeModal("vendor-modal");
            event.target.reset();
            renderAll();
        }

        function editAsset(id = "") {
            const asset = readData(STORAGE_KEYS.assets)
                .find(item => item.id === id);

            getElement("asset-modal-title").textContent =
                asset ? "Update Asset" : "Register New Asset";

            getElement("asset-id").value = asset?.id || "";
            getElement("asset-name").value = asset?.name || "";
            getElement("asset-location").value = asset?.location || "";
            getElement("asset-status").value =
                asset?.status || "";
            getElement("asset-inspected").value =
                asset?.inspected || "";

            openModal("asset-modal");
        }

        function saveAsset(event) {
    event.preventDefault();

    const assets = readData(STORAGE_KEYS.assets);
    const assetIdInput = getElement("asset-id");
    const assetId = assetIdInput.value.trim() || createAssetTag();

    const asset = {
        id: assetId,
        name: getElement("asset-name").value.trim(),
        location: getElement("asset-location").value.trim(),
        status: getElement("asset-status").value,
        inspected: getElement("asset-inspected").value
    };

    if (!asset.name || !asset.location || !asset.status || !asset.inspected) {
        alert("Please complete all asset fields.");
        return;
    }

    const existingIndex = assets.findIndex(item => item.id === assetId);

    if (existingIndex === -1) {
        assets.push(asset);
    } else {
        assets[existingIndex] = asset;
    }

    saveData(STORAGE_KEYS.assets, assets);

    closeModal("asset-modal");
    event.target.reset();
    assetIdInput.value = "";

    renderAll();
}

        function excelCell(value) {
            return `<td>${escapeHtml(value)}</td>`;
        }

        function downloadReport(title, rows, fileName) {
            const columns = Object.keys(rows[0] || { Record: "" });

            const table = `
                <table border="1">
                    <tr>
                        ${columns
                            .map(column => `<th>${escapeHtml(column)}</th>`)
                            .join("")}
                    </tr>

                    ${rows
                        .map(row => `
                            <tr>
                                ${columns
                                    .map(column =>
                                        excelCell(row[column] ?? "")
                                    )
                                    .join("")}
                            </tr>
                        `)
                        .join("")}
                </table>
            `;

            const html = `
                <html>
                    <head>
                        <meta charset="UTF-8">
                    </head>
                    <body>
                        <h2>${escapeHtml(title)}</h2>
                        ${table}
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

            setTimeout(() => {
                URL.revokeObjectURL(link.href);
            }, 1000);
        }

       function showWorkOrderReminder() {
    const openOrders = readData(STORAGE_KEYS.orders)
        .filter(order =>
            order.status === "Pending" ||
            order.status === "In Progress"
        );

    if (!openOrders.length) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "work-order-reminder-modal";
    modal.className = "modal";

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Open Work Order Reminder</h2>
                <button class="modal-close">&times;</button>
            </div>

            <p>
                These maintenance work orders still require attention:
            </p>

            <div>
                ${openOrders
                    .map(order => `
                        <div class="reminder-item">
                            <strong>
                                ${escapeHtml(order.id)} —
                                ${escapeHtml(order.status)}
                            </strong>
                            <br>
                            ${escapeHtml(order.location)}
                            <br>
                            <small>
                                ${escapeHtml(order.category)} ·
                                Priority:
                                ${escapeHtml(order.priority)}
                            </small>
                        </div>
                    `)
                    .join("")}
            </div>

            <button class="btn-submit acknowledge-work-orders">
                Acknowledge Reminder
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add("open");

    const close = () => {
        modal.classList.remove("open");

        setTimeout(() => {
            modal.remove();
        }, 200);
    };

    modal.querySelector(".modal-close").onclick = close;
    modal.querySelector(".acknowledge-work-orders").onclick = close;
}


        function downloadAllReport() {
            const sheets = {
                "52-Week PMS Calendar": readData(STORAGE_KEYS.pms),
                "Active Work Orders": readData(STORAGE_KEYS.orders),
                Projects: readData(STORAGE_KEYS.projects),
                Assets: readData(STORAGE_KEYS.assets),
                Vendors: readData(STORAGE_KEYS.vendors)
            };

            let html = `
                <html>
                    <head>
                        <meta charset="UTF-8">
                    </head>
                    <body>
                        <h1>Facilities Management Report</h1>
            `;

            Object.entries(sheets).forEach(([title, rows]) => {
                const columns = Object.keys(rows[0] || { Record: "" });

                html += `
                    <h2>${escapeHtml(title)}</h2>
                    <table border="1">
                        <tr>
                            ${columns
                                .map(column =>
                                    `<th>${escapeHtml(column)}</th>`
                                )
                                .join("")}
                        </tr>
                `;

                html += rows
                    .map(row => `
                        <tr>
                            ${columns
                                .map(column =>
                                    excelCell(row[column] ?? "")
                                )
                                .join("")}
                        </tr>
                    `)
                    .join("");

                html += `
                    </table>
                    <br>
                `;
            });

            html += `
                    </body>
                </html>
            `;

            const blob = new Blob([html], {
                type: "application/vnd.ms-excel"
            });

            const link = document.createElement("a");

            link.href = URL.createObjectURL(blob);
            link.download = `facilities-report-${getToday()}.xls`;
            link.click();

            setTimeout(() => {
                URL.revokeObjectURL(link.href);
            }, 1000);
        }
const originalSetupEventHandlers = setupEventHandlers;

        function addWorkOrderEnhancements() {
            const heading = document.querySelector(
                "#work-orders-table"
            ).closest(".panel").querySelector(".section-heading");

            if (!getElement("order-search")) {
                const searchInput = document.createElement("input");

                searchInput.id = "order-search";
                searchInput.className = "search";
                searchInput.placeholder =
                    "Search work orders by ID, location, category, priority, description, or status";
                searchInput.style.maxWidth = "420px";

                heading.insertAdjacentElement("afterend", searchInput);

                const notice = document.createElement("p");
                notice.id = "work-order-list-notice";
                notice.style.cssText =
                    "color:#64748b;font-size:13px;margin-bottom:12px;";
                heading.parentElement.insertBefore(
                    notice,
                    document.querySelector("#work-orders-table").parentElement
                );
            }
        }

        function enhancedAddOrder(event) {
            event.preventDefault();

            const orders = readData(STORAGE_KEYS.orders);

            orders.unshift({
                id: createWorkOrderId(),
                location: getElement("location").value.trim(),
                category: getElement("category").value,
                priority: getElement("priority").value,
                description: getElement("description").value.trim(),
                reported: getElement("date-reported").value,
                completed: "",
                status: "Pending"
            });

            saveData(STORAGE_KEYS.orders, orders);
            event.target.reset();
            getElement("date-reported").value = getToday();
            renderAll();
        }

        function enhancedRenderOrders() {
    const tableBody = document.querySelector("#work-orders-table tbody");
    const searchTerm = (
        getElement("order-search")?.value || ""
    ).toLowerCase().trim();

    const allOrders = readData(STORAGE_KEYS.orders);

    const filteredOrders = allOrders
        .filter(order =>
            Object.values(order)
                .join(" ")
                .toLowerCase()
                .includes(searchTerm)
        )
        .slice(0, 10);

    tableBody.textContent = "";

    filteredOrders.forEach(order => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHtml(order.id)}</td>
            <td>${escapeHtml(order.location)}</td>
            <td>${escapeHtml(order.category)}</td>
            <td>${escapeHtml(order.priority)}</td>
            <td>${escapeHtml(order.description || "")}</td>
            <td>${escapeHtml(order.reported || "")}</td>
            <td>${escapeHtml(order.completed || "")}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td>
                <button
                    type="button"
                    class="btn-action btn-primary order-edit"
                    data-id="${escapeHtml(order.id)}"
                >
                    Edit
                </button>

                <button
                    type="button"
                    class="btn-action btn-danger order-delete"
                    data-id="${escapeHtml(order.id)}"
                >
                    Delete
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll(".order-edit").forEach(button => {
        button.onclick = () => {
            editWorkOrder(button.dataset.id);
        };
    });

    tableBody.querySelectorAll(".order-delete").forEach(button => {
        button.onclick = async () => {
            const authorized = await requireAdminPassword(
                "delete this work order"
            );

            if (
                authorized &&
                confirm("Delete this maintenance work order?")
            ) {
                const remainingOrders = readData(STORAGE_KEYS.orders)
                    .filter(order => order.id !== button.dataset.id);

                saveData(STORAGE_KEYS.orders, remainingOrders);
                renderAll();
            }
        };
    });

    const notice = getElement("work-order-list-notice");

    if (notice) {
        notice.textContent = searchTerm
            ? `Showing ${filteredOrders.length} matching work order(s).`
            : `Showing ${Math.min(allOrders.length, 10)} of ${allOrders.length} work order(s). Older records remain available for download.`;
    }
}

        setupEventHandlers = function () {
            addWorkOrderEnhancements();
            originalSetupEventHandlers();

            getElement("facility-form").onsubmit = enhancedAddOrder;
            getElement("order-search").oninput = renderOrders;
        };

        renderOrders = enhancedRenderOrders;

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
                        <button class="modal-close" type="button">&times;</button>
                    </div>

                    <form id="work-order-edit-form">
                        <input type="hidden" id="edit-order-id">

                        <div class="form-group">
                            <label for="edit-order-location">
                                Location / Building Zone
                            </label>
                            <input id="edit-order-location" required>
                        </div>

                        <div class="form-group">
                            <label for="edit-order-category">Category</label>
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
                            <label for="edit-order-priority">Priority Level</label>
                            <select id="edit-order-priority">
                                <option>Low</option>
                                <option>Medium</option>
                                <option>High</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="edit-order-description">
                                Problem Description
                            </label>
                            <textarea id="edit-order-description" required></textarea>
                        </div>

                        <div class="form-group">
                            <label for="edit-order-reported">Date Reported</label>
                            <input type="date" id="edit-order-reported" required>
                        </div>

                        <div class="form-group">
                            <label for="edit-order-completed">
                                Date Completed
                            </label>
                            <input type="date" id="edit-order-completed">
                        </div>

                        <div class="form-group">
                            <label for="edit-order-status">Status</label>
                            <select id="edit-order-status">
                                <option>Pending</option>
                                <option>In Progress</option>
                                <option>Completed</option>
                                <option>Cancelled</option>
                            </select>
                            
                        </div>

                        <button type="submit" class="btn-submit">
                            Save Work Order
                        </button>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector(".modal-close").onclick = () => {
                modal.classList.remove("open");
            };

            getElement("work-order-edit-form").onsubmit = event => {
                event.preventDefault();

                const orders = readData(STORAGE_KEYS.orders);
                const order = orders.find(
                    item => item.id === getElement("edit-order-id").value
                );

                if (!order) {
                    return;
                }

                order.location = getElement("edit-order-location").value.trim();
                order.category = getElement("edit-order-category").value;
                order.priority = getElement("edit-order-priority").value;
                order.description =
                    getElement("edit-order-description").value.trim();
                order.reported = getElement("edit-order-reported").value;
                order.completed = getElement("edit-order-completed").value;
                order.status = getElement("edit-order-status").value;

                saveData(STORAGE_KEYS.orders, orders);
                modal.classList.remove("open");
                renderAll();
            };
        }

 document.addEventListener("DOMContentLoaded", () => {
            const originalEditVendor = window.editVendor;

            if (typeof originalEditVendor !== "function") {
                return;
            }

            window.editVendor = function (id = "") {
                const vendor = readData(STORAGE_KEYS.vendors)
                    .find(item => item.id === id);

                getElement("vendor-record-id").value = vendor?.id || "";
                getElement("vendor-id").value = vendor?.id || "";
                getElement("vendor-company").value = vendor?.company || "";
                getElement("vendor-specialization").value =
                    vendor?.specialization || "";
                getElement("vendor-contact").value = vendor?.contact || "";
                getElement("vendor-phone").value = vendor?.phone || "";
                getElement("vendor-status").value = vendor?.status || "";

                openModal("vendor-modal");
            };
        });

        function editWorkOrder(id) {
            const order = readData(STORAGE_KEYS.orders)
                .find(item => item.id === id);

            if (!order) {
                return;
            }

            getElement("edit-order-id").value = order.id;
            getElement("edit-order-location").value = order.location || "";
            getElement("edit-order-category").value = order.category || "";
            getElement("edit-order-priority").value = order.priority || "";
            getElement("edit-order-description").value =
                order.description || "";
            getElement("edit-order-reported").value = order.reported || "";
            getElement("edit-order-completed").value =
                order.completed || "";
            getElement("edit-order-status").value =
                order.status || "";

            openModal("work-order-edit-modal");
        }

        const originalEnhancedSetupEventHandlers = setupEventHandlers;

        setupEventHandlers = function () {
            createWorkOrderEditModal();
            originalEnhancedSetupEventHandlers();
            
        };
        function setupLogIssueModal() {
            const issuePanel = document
                .querySelector("#facility-form")
                ?.closest(".panel");

            const ordersPanel = document
                .querySelector("#work-orders-table")
                ?.closest(".panel");

            if (!issuePanel || !ordersPanel || getElement("log-new-issue-button")) {
                return;
            }

            issuePanel.style.display = "none";

            const button = document.createElement("button");
            button.id = "log-new-issue-button";
            button.type = "button";
            button.className = "report-button";
            button.textContent = "+ Log New Issue";

            const downloadButton = getElement("download-orders-report");
            const heading = ordersPanel.querySelector(".section-heading");

            heading.style.justifyContent = "flex-start";
            heading.style.gap = "4px";
            heading.querySelector("h2").style.marginRight = "auto";
            heading.insertBefore(button, downloadButton);

            const modal = document.createElement("div");
            modal.id = "log-issue-modal";
            modal.className = "modal issue-form-modal";

            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Log New Issue</h2>
                        <button type="button" class="modal-close">&times;</button>
                    </div>

                    <form id="modal-facility-form">
                        <div class="form-group">
                            <label for="modal-date-reported">Date Reported</label>
                            <input type="date" id="modal-date-reported" required>
                        </div>

                        <div class="form-group">
                            <label for="modal-location">Location / Building Zone</label>
                            <input id="modal-location" required>
                        </div>

                        <div class="form-group">
                            <label for="modal-category">Category</label>
                            <select id="modal-category" required>
                                
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
                            <label for="modal-priority">Priority Level</label>
                            <select id="modal-priority">
                                <option>Low</option>
                                <option>Medium</option>
                                <option>High</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="modal-description">Problem Description</label>
                            <textarea id="modal-description" required></textarea>
                        </div>

                        <button type="submit" class="btn-submit">
                            Dispatch Maintenance Request
                        </button>
                    </form>
                </div>


                
            `;

            document.body.appendChild(modal);

            const closeModalWindow = () => {
                modal.classList.remove("open");
            };
const modalDate = modal.querySelector("#modal-date-reported");

modalDate.title = "Select Date Reported";
modalDate.setAttribute("aria-label", "Select Date Reported");

const dateNote = document.createElement("small");
dateNote.className = "date-input-note";
dateNote.textContent = "Select Date Reported (MM/DD/YYYY)";
modalDate.insertAdjacentElement("afterend", dateNote);

            button.onclick = () => {
                modal.querySelector("#modal-date-reported").value = "";
                modal.classList.add("open");
            };

            modal.querySelector(".modal-close").onclick = closeModalWindow;

            modal.onclick = event => {
                if (event.target === modal) {
                    closeModalWindow();
                }
            };

            modal.querySelector("#modal-facility-form").onsubmit = event => {
                event.preventDefault();

                const orders = readData(STORAGE_KEYS.orders);

                orders.unshift({
                    id: createWorkOrderId(),
                    location: modal.querySelector("#modal-location").value.trim(),
                    category: modal.querySelector("#modal-category").value,
                    priority: modal.querySelector("#modal-priority").value,
                    description: modal.querySelector("#modal-description").value.trim(),
                    reported: modal.querySelector("#modal-date-reported").value,
                    completed: "",
                    status: "Pending"
                });

                saveData(STORAGE_KEYS.orders, orders);
                event.target.reset();
                closeModalWindow();
                renderAll();
            };
        }

        const USER_STORAGE_KEY = "fms_users";

function getUsers() {
    const users = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "null");

    if (Array.isArray(users) && users.length) {
        return users;
    }

    const defaultUsers = [
        {
            username: "admin",
            password: ADMIN_PASSWORD,
            role: "Administrator"
        }
    ];

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(defaultUsers));
    return defaultUsers;
}

function saveUsers(users) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
}

function setupUserAuthentication() {
    const loginCard = document.querySelector(".login-card");
    const loginForm = getElement("login-form");

    if (!loginCard || !loginForm) {
    return;
}

if (getElement("register-user-button")) {
    return;
}

    const registerButton = document.createElement("button");
    registerButton.id = "register-user-button";
    registerButton.type = "button";
    registerButton.className = "btn-cancel";
    registerButton.style.cssText =
        "width:100%;margin-top:10px;padding:11px;border:0;border-radius:6px;font-weight:600;";
    registerButton.textContent = "Register New User";

    loginForm.appendChild(registerButton);

    const registerModal = document.createElement("div");
    registerModal.id = "register-user-modal";
    registerModal.className = "modal";
    registerModal.style.zIndex = "110";

    registerModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Register New User</h2>
                <button type="button" class="modal-close">&times;</button>
            </div>

            <form id="register-user-form">
                <div class="form-group">
                    <label for="register-username">Username</label>
                    <input id="register-username" required>
                </div>

                <div class="form-group">
                    <label for="register-password">Password</label>
                    <input id="register-password" type="password" required>
                </div>

                <div class="form-group">
                    <label for="register-confirm-password">
                        Confirm Password
                    </label>
                    <input
                        id="register-confirm-password"
                        type="password"
                        required
                    >
                </div>

                <button class="btn-submit" type="submit">
                    Create User
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(registerModal);

    registerButton.onclick = () => {
        registerModal.classList.add("open");
    };

    registerModal.querySelector(".modal-close").onclick = () => {
        registerModal.classList.remove("open");
    };

    registerModal.querySelector("#register-user-form").onsubmit = event => {
        event.preventDefault();

        const username = getElement("register-username").value.trim();
        const password = getElement("register-password").value;
        const confirmPassword = getElement("register-confirm-password").value;
        const users = getUsers();

        if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
            alert("That username already exists.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        users.push({
            username,
            password,
            role: "User"
        });

        saveUsers(users);
        event.target.reset();
        registerModal.classList.remove("open");
        alert("User registered successfully.");
    };

    handleLogin = function(event) {
        event.preventDefault();

        const username = getElement("login-username").value.trim();
        const password = getElement("login-password").value;

        const user = getUsers().find(
            item =>
                item.username.toLowerCase() === username.toLowerCase() &&
                item.password === password
        );

        if (!user) {
            getElement("login-error").textContent =
                "Invalid username or password.";
            getElement("login-error").classList.add("visible");
            getElement("login-password").select();
            return;
        }

        sessionStorage.setItem("fms_logged_in", "true");
        sessionStorage.setItem("fms_current_user", user.username);
        sessionStorage.setItem("fms_current_role", user.role);

        getElement("login-screen").classList.add("hidden");
        getElement("login-error").classList.remove("visible");
        getElement("login-screen").style.display = "";
        
document.querySelector(".sidebar").style.display = "";
document.querySelector(".main-content").style.display = "";

        if (user.role === "Administrator") {
            createUserManagementButton();
        }
    };
}

function createUserManagementButton() {
    if (getElement("manage-users-button")) {
        return;
    }

    const button = document.createElement("button");
    button.id = "manage-users-button";
    button.type = "button";
    button.className = "btn-action btn-primary";
    button.textContent = "Manage Users";
    button.style.marginLeft = "8px";

    getElement("download-report").parentElement.appendChild(button);

    const modal = document.createElement("div");
    modal.id = "manage-users-modal";
    modal.className = "modal";

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Manage Users</h2>
                <button type="button" class="modal-close">&times;</button>
            </div>

            <div id="user-list"></div>
        </div>
    `;

    document.body.appendChild(modal);

    const renderUsers = () => {
        const currentUsername = sessionStorage.getItem("fms_current_user");

        getElement("user-list").innerHTML = getUsers()
            .map(user => `
                <div class="reminder-item">
                    <strong>${escapeHtml(user.username)}</strong>
                    <small>
                        ${escapeHtml(user.role)}
                    </small>

                    <div style="margin-top:8px">
                        <button
                            type="button"
                            class="btn-action btn-primary edit-user-password"
                            data-username="${escapeHtml(user.username)}"
                        >
                            Edit Password
                        </button>

                        ${
                            user.username !== "admin" &&
                            user.username !== currentUsername
                                ? `
                                    <button
                                        type="button"
                                        class="btn-action btn-danger delete-user"
                                        data-username="${escapeHtml(user.username)}"
                                    >
                                        Delete User
                                    </button>
                                `
                                : ""
                        }
                    </div>
                </div>
            `)
            .join("");

        getElement("user-list")
            .querySelectorAll(".edit-user-password")
            .forEach(button => {
                button.onclick = () => {
                    const username = button.dataset.username;
                    const password = prompt(
                        `Enter a new password for ${username}:`
                    );

                    if (!password) {
                        return;
                    }

                    const users = getUsers();
                    const user = users.find(item => item.username === username);

                    if (user) {
                        user.password = password;
                        saveUsers(users);
                        alert("Password updated successfully.");
                    }
                };
            });

        getElement("user-list")
            .querySelectorAll(".delete-user")
            .forEach(button => {
                button.onclick = () => {
                    const username = button.dataset.username;

                    if (!confirm(`Delete user "${username}"?`)) {
                        return;
                    }

                    saveUsers(
                        getUsers().filter(user => user.username !== username)
                    );

                    renderUsers();
                };
            });
    };

    button.onclick = () => {
        renderUsers();
        modal.classList.add("open");
    };

    modal.querySelector(".modal-close").onclick = () => {
        modal.classList.remove("open");
    };
}

        const originalInitializeApplication = initializeApplication;

        initializeApplication = function () {
            originalInitializeApplication();

            setupLogIssueModal();
            setupUserAuthentication();

            // Reattach the login handler after the authentication setup.
            getElement("login-form").onsubmit = handleLogin;

            getUsers();

            if (
                sessionStorage.getItem("fms_current_role") ===
                "Administrator"
            ) {
                createUserManagementButton();
            }
        };

        document.addEventListener(
            "DOMContentLoaded",
            initializeApplication
        );
        
   
      (() => {
    const AUDIT_KEY = "fms_activity_logs";
    const DATA_KEYS = {
        fms_work_orders_data: "Work Order",
        fms_assets_data: "Asset",
        fms_pms_data: "PMS Task",
        fms_projects_data: "Project",
        fms_vendors_data: "Vendor"
    };

    const getLogs = () => {
        try {
            return JSON.parse(localStorage.getItem(AUDIT_KEY)) || [];
        } catch {
            return [];
        }
    };

    const saveLogs = logs => {
        localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, 500)));
    };

    const currentUser = () =>
        sessionStorage.getItem("fms_current_user") || "Unknown user";

    function recordAudit(action, module, recordId = "", details = "") {
        const logs = getLogs();

        logs.unshift({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            username: currentUser(),
            action,
            module,
            recordId,
            details
        });

        saveLogs(logs);
    }

    function compareRecords(oldRows, newRows, module) {
        const oldMap = new Map(
            oldRows.map(row => [String(row.id), JSON.stringify(row)])
        );
        const newMap = new Map(
            newRows.map(row => [String(row.id), JSON.stringify(row)])
        );

        newRows.forEach(row => {
            const id = String(row.id);

            if (!oldMap.has(id)) {
                recordAudit("Input", module, id, "New record created");
            } else if (oldMap.get(id) !== newMap.get(id)) {
                recordAudit("Edit", module, id, "Record updated");
            }
        });

        oldRows.forEach(row => {
            const id = String(row.id);

            if (!newMap.has(id)) {
                recordAudit("Delete", module, id, "Record deleted");
            }
        });
    }

    const originalSetItem = localStorage.setItem.bind(localStorage);

    localStorage.setItem = (key, value) => {
        let oldRows = [];

        if (DATA_KEYS[key]) {
            try {
                oldRows = JSON.parse(localStorage.getItem(key)) || [];
            } catch {
                oldRows = [];
            }
        }

        originalSetItem(key, value);

        if (DATA_KEYS[key]) {
            try {
                const newRows = JSON.parse(value) || [];

                if (Array.isArray(oldRows) && Array.isArray(newRows)) {
                    compareRecords(oldRows, newRows, DATA_KEYS[key]);
                }
            } catch {
                // Ignore invalid storage values.
            }
        }
    };

    function renderAuditLog(body) {
        const logs = getLogs();
        body.textContent = "";

        if (!logs.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="7">No activity has been recorded.</td>
                </tr>
            `;
            return;
        }

        logs.forEach(log => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHtml(new Date(log.timestamp).toLocaleString())}</td>
                <td>${escapeHtml(log.username)}</td>
                <td>${escapeHtml(log.action)}</td>
                <td>${escapeHtml(log.module)}</td>
                <td>${escapeHtml(log.recordId)}</td>
                <td>${escapeHtml(log.details)}</td>
                <td>
                    <button
                        type="button"
                        class="btn-action btn-danger"
                        data-delete-log="${escapeHtml(log.id)}"
                    >
                        Delete
                    </button>
                </td>
            `;

            body.appendChild(row);
        });

        body.querySelectorAll("[data-delete-log]").forEach(button => {
            button.onclick = () => {
                saveLogs(
                    getLogs().filter(log =>
                        log.id !== button.dataset.deleteLog
                    )
                );

                renderAuditLog(body);
            };
        });
    }

    function createAuditModal() {
        if (
            document.getElementById("audit-log-modal") ||
            sessionStorage.getItem("fms_current_role") !== "Administrator"
        ) {
            return;
        }

        const manageButton = document.getElementById("manage-users-button");

        if (!manageButton) {
            return;
        }

        const button = document.createElement("button");
        button.id = "view-audit-log-button";
        button.type = "button";
        button.className = "btn-action btn-primary";
        button.textContent = "View Activity Log";
        button.style.marginLeft = "8px";

        manageButton.parentElement.appendChild(button);

        const modal = document.createElement("div");
        modal.id = "audit-log-modal";
        modal.className = "modal";

        modal.innerHTML = `
            <div class="modal-content" style="width:min(950px,100%)">
                <div class="modal-header">
                    <h2>User Activity Log</h2>
                    <button type="button" class="modal-close">&times;</button>
                </div>

                <button
                    type="button"
                    class="btn-action btn-danger"
                    id="clear-audit-log"
                    style="margin-bottom:15px"
                >
                    Clear Activity Log
                </button>

                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date and Time</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Module</th>
                                <th>Record ID</th>
                                <th>Details</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="audit-log-body"></tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const body = modal.querySelector("#audit-log-body");

        button.onclick = () => {
            renderAuditLog(body);
            modal.classList.add("open");
        };

        modal.querySelector(".modal-close").onclick = () => {
            modal.classList.remove("open");
        };

        modal.querySelector("#clear-audit-log").onclick = () => {
            if (confirm("Clear the complete activity log?")) {
                saveLogs([]);
                renderAuditLog(body);
            }
        };
    }

    document.addEventListener("submit", event => {
        if (event.target.id !== "login-form") {
            return;
        }

        setTimeout(() => {
            if (sessionStorage.getItem("fms_logged_in") === "true") {
                const username =
                    sessionStorage.getItem("fms_current_user") ||
                    document.getElementById("login-username")?.value.trim() ||
                    "Unknown user";

                sessionStorage.setItem("fms_current_user", username);

                recordAudit(
                    "Login",
                    "Authentication",
                    username,
                    "User logged into the system"
                );

                createAuditModal();
            }
        }, 50);
    });

    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(createAuditModal, 300);
    });
})();
    
    document.addEventListener("DOMContentLoaded", () => {
        const placeholderOptions = {
            "category": "Select Category",
            "priority": "Select Priority Level",
            "project-status": "Select Project Status",
            "pms-type": "Select Maintenance Type",
            "pms-status": "Select PMS Status",
            "vendor-status": "Select Vendor Status",
            "asset-status": "Select Asset Health Status",
            "edit-order-category": "Select Category",
            "edit-order-priority": "Select Priority Level",
            "edit-order-status": "Select Work Order Status",
            "modal-category": "Select Category",
            "modal-priority": "Select Priority Level"
        };

        Object.entries(placeholderOptions).forEach(([id, text]) => {
            const select = document.getElementById(id);

            if (!select || select.querySelector("option[data-placeholder]")) {
                return;
            }

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = text;
            placeholder.disabled = true;
            placeholder.selected = true;
            placeholder.hidden = true;
            placeholder.dataset.placeholder = "true";

            select.insertBefore(placeholder, select.firstChild);
            select.required = true;
        });

        const dateFields = [
            ["date-reported", "Select Date Reported"],
            ["project-start", "Select Project Start Date"],
            ["project-target", "Select Project Target Date"],
            ["pms-date", "Select PMS Due Date"],
            ["asset-inspected", "Select Inspection Date"],
            ["edit-order-reported", "Select Date Reported"],
            ["edit-order-completed", "Select Date Completed"],
            ["modal-date-reported", "Select Date Reported"]
        ];

        dateFields.forEach(([id, note]) => {
            const input = document.getElementById(id);

            if (!input) {
                return;
            }

            input.title = note;
            input.setAttribute("aria-label", note);

            if (
                !input.nextElementSibling?.classList.contains(
                    "date-input-note"
                )
            ) {
                const dateNote = document.createElement("small");
                dateNote.className = "date-input-note";
                dateNote.textContent = `${note} (MM/DD/YYYY)`;
                input.insertAdjacentElement("afterend", dateNote);
            }
        });
    });
(() => {
    const theme = {
        primary: "#0f766e",
        secondary: "#14b8a6",
        light: "#f0fdfa",
        border: "#cbd5e1",
        text: "#1e293b",
        muted: "#64748b",
        white: "#ffffff"
    };

    const escapeValue = value => {
        const element = document.createElement("div");
        element.textContent = value ?? "";
        return element.innerHTML;
    };

    const formatDate = () =>
        new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });

    const formatTime = () =>
        new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit"
        });

    function createStyledTable(rows) {
        const columns = Object.keys(rows[0] || { Record: "" });

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        ${columns
                            .map(column => `
                                <th>${escapeValue(column)}</th>
                            `)
                            .join("")}
                    </tr>
                </thead>
                <tbody>
                    ${
                        rows.length
                            ? rows
                                .map(row => `
                                    <tr>
                                        ${columns
                                            .map(column => `
                                                <td>
                                                    ${escapeValue(row[column] ?? "")}
                                                </td>
                                            `)
                                            .join("")}
                                    </tr>
                                `)
                                .join("")
                            : `
                                <tr>
                                    <td colspan="${columns.length}" class="empty">
                                        No records available
                                    </td>
                                </tr>
                            `
                    }
                </tbody>
            </table>
        `;
    }

    function createWorkbook(title, sections) {
        return `
            <html xmlns:o="urn:schemas-microsoft-com:office:office"
                  xmlns:x="urn:schemas-microsoft-com:office:excel"
                  xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="UTF-8">

                    <!--[if gte mso 9]>
                    <xml>
                        <x:ExcelWorkbook>
                            <x:ExcelWorksheets>
                                <x:ExcelWorksheet>
                                    <x:Name>Facilities Report</x:Name>
                                    <x:WorksheetOptions>
                                        <x:Print>
                                            <x:ValidPrinterInfo/>
                                        </x:Print>
                                    </x:WorksheetOptions>
                                </x:ExcelWorksheet>
                            </x:ExcelWorksheets>
                        </x:ExcelWorkbook>
                    </xml>
                    <![endif]-->

                    <style>
                        @page {
                            margin: 0.65in;
                        }

                        * {
                            font-family: Arial, Helvetica, sans-serif;
                        }

                        body {
                            color: ${theme.text};
                            background: ${theme.white};
                            margin: 0;
                            padding: 24px;
                            font-size: 12pt;
                        }

                        .report-header {
                            border-bottom: 5px solid ${theme.secondary};
                            background: ${theme.primary};
                            color: ${theme.white};
                            padding: 22px 26px;
                            margin-bottom: 24px;
                        }

                        .report-title {
                            font-size: 24pt;
                            font-weight: 700;
                            margin: 0 0 8px;
                        }

                        .report-subtitle {
                            font-size: 12pt;
                            margin: 0;
                        }

                        .report-info {
                            color: ${theme.muted};
                            font-size: 11pt;
                            margin: 0 0 26px;
                        }

                        .section-title {
                            background: ${theme.light};
                            border-left: 5px solid ${theme.primary};
                            color: ${theme.primary};
                            font-size: 16pt;
                            font-weight: 700;
                            padding: 10px 14px;
                            margin: 28px 0 12px;
                        }

                        .data-table {
                            border-collapse: collapse;
                            width: 100%;
                            margin-bottom: 24px;
                            font-size: 12pt;
                        }

                        .data-table th {
                            background: ${theme.primary};
                            color: ${theme.white};
                            border: 1px solid ${theme.primary};
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 14pt;
                            font-weight: 700;
                            padding: 12px 10px;
                            text-align: left;
                            white-space: nowrap;
                        }

                        .data-table td {
                            color: ${theme.text};
                            background: ${theme.white};
                            border: 1px solid ${theme.border};
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 10pt;
                            padding: 10px;
                            vertical-align: top;
                        }

                        .data-table tbody tr:nth-child(even) td {
                            background: ${theme.light};
                        }

                        .empty {
                            color: ${theme.muted};
                            font-size: 12pt;
                            font-style: italic;
                            text-align: center;
                            padding: 18px !important;
                        }

                        .report-footer {
                            border-top: 1px solid ${theme.border};
                            color: ${theme.muted};
                            font-size: 10pt;
                            margin-top: 30px;
                            padding-top: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="report-header">
                        <h1 class="report-title">
                            Facilities Management System
                        </h1>

                        <p class="report-subtitle">
                            ${escapeValue(title)}
                        </p>
                    </div>

                    <p class="report-info">
                        Generated on ${escapeValue(formatDate())}
                        at ${escapeValue(formatTime())}
                    </p>

                    ${sections
                        .map(section => `
                            <h2 class="section-title">
                                ${escapeValue(section.title)}
                            </h2>
                            ${createStyledTable(section.rows)}
                        `)
                        .join("")}

                    <div class="report-footer">
                        Confidential facilities management report.
                    </div>
                </body>
            </html>
        `;
    }

    function downloadWorkbook(title, sections, fileName) {
        const workbook = createWorkbook(title, sections);
        const blob = new Blob([workbook], {
            type: "application/vnd.ms-excel"
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}-${getToday()}.xls`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(link.href);
        }, 1000);
    }

    function reportButton(buttonId, title, storageKey, fileName) {
        const button = document.getElementById(buttonId);

        if (!button) {
            return;
        }

        button.onclick = () => {
            downloadWorkbook(
                title,
                [
                    {
                        title,
                        rows: readData(storageKey)
                    }
                ],
                fileName
            );
        };
    }

    function setupProfessionalExports() {
        reportButton(
            "download-pms-report",
            "52-Week PMS Calendar",
            STORAGE_KEYS.pms,
            "pms-calendar"
        );

        reportButton(
            "download-orders-report",
            "Active Maintenance Work Orders",
            STORAGE_KEYS.orders,
            "maintenance-work-orders"
        );

        reportButton(
            "download-projects-report",
            "Project Management",
            STORAGE_KEYS.projects,
            "projects"
        );

        reportButton(
            "download-assets-report",
            "Asset Tracking",
            STORAGE_KEYS.assets,
            "assets"
        );

        reportButton(
            "download-vendors-report",
            "Vendor Directory",
            STORAGE_KEYS.vendors,
            "vendors"
        );

        const allReportButton = document.getElementById("download-report");

        if (allReportButton) {
            allReportButton.onclick = () => {
                downloadWorkbook(
                    "Complete Facilities Management Report",
                    [
                        {
                            title: "52-Week PMS Calendar",
                            rows: readData(STORAGE_KEYS.pms)
                        },
                        {
                            title: "Active Maintenance Work Orders",
                            rows: readData(STORAGE_KEYS.orders)
                        },
                        {
                            title: "Project Management",
                            rows: readData(STORAGE_KEYS.projects)
                        },
                        {
                            title: "Asset Tracking",
                            rows: readData(STORAGE_KEYS.assets)
                        },
                        {
                            title: "Vendor Directory",
                            rows: readData(STORAGE_KEYS.vendors)
                        }
                    ],
                    "facilities-report"
                );
            };
        }
    }

    document.addEventListener("DOMContentLoaded", setupProfessionalExports);
})();
(() => {
    function renderManualCalendar() {
        const yearInput = document.getElementById("calendar-year");
        const calendar = document.getElementById("maintenance-calendar");

        if (!yearInput || !calendar) {
            return;
        }

        const year = Number(yearInput.value);

        if (!Number.isInteger(year) || year < 1900 || year > 9999) {
            calendar.textContent = "";
            return;
        }

        calendar.textContent = "";

        const firstDay = new Date(year, 0, 1);
        firstDay.setDate(
            firstDay.getDate() - ((firstDay.getDay() + 6) % 7)
        );

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

            const tasks = readData(STORAGE_KEYS.pms)
                .filter(task => {
                    const taskDate = new Date(`${task.date}T00:00:00`);
                    return taskDate >= startDate && taskDate <= endDate;
                })
                .map(task => `
                    <div class="maintenance-dot ${
                        task.status === "Done" ? "done" : ""
                    }">
                        <strong>${escapeHtml(task.asset)}</strong>
                        <br>
                        ${escapeHtml(task.type)}
                        <small>
                            ${escapeHtml(task.status)} ·
                            ${escapeHtml(task.date)}
                        </small>

                        <button
                            class="btn-action"
                            data-edit-pms="${escapeHtml(task.id)}"
                        >
                            Edit
                        </button>

                        <button
                            class="btn-action btn-danger"
                            data-delete-pms="${escapeHtml(task.id)}"
                        >
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

    document.addEventListener("DOMContentLoaded", () => {
        const yearControl = document.getElementById("calendar-year");

        if (!yearControl) {
            return;
        }

        const yearInput = document.createElement("input");
        yearInput.id = "calendar-year";
        yearInput.type = "number";
        yearInput.min = "1900";
        yearInput.max = "9999";
        yearInput.step = "1";
        yearInput.value = new Date().getFullYear();
        yearInput.title = "Enter calendar year";
        yearInput.setAttribute("aria-label", "Enter calendar year");

        yearControl.replaceWith(yearInput);

        yearInput.addEventListener("change", renderManualCalendar);

        yearInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                renderManualCalendar();
            }
        });

        window.renderCalendar = renderManualCalendar;
        renderManualCalendar();
    });
})();
(function setupRolePermissions() {
    const restrictedSelectors = [
        ".order-delete",
        "[data-del]",
        "[data-delete-pms]",
        "[data-delete-project]",
        "[data-delete-vendor]",
        "[data-delete-log]",
        ".delete-user",
        "#manage-users-button",
        "#view-audit-log-button"
    ];

    function isAdministrator() {
        return (
            sessionStorage.getItem("fms_current_role") === "Administrator" ||
            (
                sessionStorage.getItem("fms_current_user") === "admin" &&
                sessionStorage.getItem("fms_logged_in") === "true"
            )
        );
    }

    function applyRolePermissions() {
        const administrator = isAdministrator();

        document.body.classList.toggle("administrator-role", administrator);
        document.body.classList.toggle("regular-user-role", !administrator);

        document
            .querySelectorAll(restrictedSelectors.join(","))
            .forEach(control => {
                control.hidden = !administrator;
                control.setAttribute(
                    "aria-hidden",
                    administrator ? "false" : "true"
                );
            });

        const manageUsersButton = getElement("manage-users-button");

        if (manageUsersButton && !administrator) {
            manageUsersButton.remove();
        }

        const auditButton = getElement("view-audit-log-button");

        if (auditButton && !administrator) {
            auditButton.remove();
        }
    }

    const permissionStyle = document.createElement("style");

    permissionStyle.textContent = `
        body.regular-user-role .order-delete,
        body.regular-user-role [data-del],
        body.regular-user-role [data-delete-pms],
        body.regular-user-role [data-delete-project],
        body.regular-user-role [data-delete-vendor],
        body.regular-user-role [data-delete-log],
        body.regular-user-role .delete-user,
        body.regular-user-role #manage-users-button,
        body.regular-user-role #view-audit-log-button {
            display: none !important;
        }
    `;

    document.head.appendChild(permissionStyle);

    document.addEventListener("DOMContentLoaded", () => {
        applyRolePermissions();

        const observer = new MutationObserver(applyRolePermissions);

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

    document.addEventListener("submit", event => {
        if (event.target.id !== "login-form") {
            return;
        }

        setTimeout(applyRolePermissions, 100);
    });

    window.applyRolePermissions = applyRolePermissions;
})();