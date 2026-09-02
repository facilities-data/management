(() => {
    const SUPABASE_URL = "https://xoysdiavwxfuqygzonjt.supabase.co";
    const SUPABASE_ANON_KEY =
        "sb_publishable_2bARynoBkd0_tAjS2kXbYw_WQndR9j-";
    const TABLE_NAME = "fms_browser_storage";

    const SYNC_KEYS = [
        "fms_work_orders_data",
        "fms_assets_data",
        "fms_pms_data",
        "fms_projects_data",
        "fms_vendors_data",
        "fms_special_requests",
        "fms_activity_logs"
    ];

    const SUPABASE_CDN =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    let client = null;
    let syncReady = false;
    let syncStarted = false;
    let applyingRemoteData = false;
    let downloadingData = false;

    const uploadTimers = new Map();

    function loadSupabaseLibrary() {
        if (window.supabase?.createClient) {
            return Promise.resolve();
        }

        if (window.supabaseLibraryReady) {
            return window.supabaseLibraryReady;
        }

        return new Promise((resolve, reject) => {
            const existingScript = document.querySelector(
                `script[src="${SUPABASE_CDN}"]`
            );

            if (existingScript) {
                existingScript.addEventListener("load", resolve, {
                    once: true
                });
                existingScript.addEventListener("error", reject, {
                    once: true
                });

                setTimeout(() => {
                    if (window.supabase?.createClient) {
                        resolve();
                    }
                }, 1000);

                return;
            }

            const script = document.createElement("script");
            script.src = SUPABASE_CDN;
            script.onload = resolve;
            script.onerror = () =>
                reject(new Error("Supabase CDN failed to load."));
            document.head.appendChild(script);
        });
    }

    async function createSupabaseClient() {
        if (client) {
            return true;
        }

        try {
            await loadSupabaseLibrary();

            if (!window.supabase?.createClient) {
                throw new Error("Supabase library is unavailable.");
            }

            client = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );

            return true;
        } catch (error) {
            console.error(
                "Supabase initialization failed:",
                error.message
            );
            return false;
        }
    }

    function readLocal(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || "[]");
        } catch {
            return [];
        }
    }

    function valuesAreEqual(first, second) {
        return JSON.stringify(first) === JSON.stringify(second);
    }

    function writeLocalIfChanged(key, value) {
        const currentValue = readLocal(key);

        if (valuesAreEqual(currentValue, value)) {
            return false;
        }

        applyingRemoteData = true;

        try {
            localStorage.setItem(key, JSON.stringify(value));
        } finally {
            applyingRemoteData = false;
        }

        return true;
    }

    async function uploadKey(key) {
        if (
            !client ||
            !syncReady ||
            applyingRemoteData ||
            downloadingData
        ) {
            return;
        }

        const { error } = await client
            .from(TABLE_NAME)
            .upsert(
                {
                    storage_key: key,
                    data: readLocal(key),
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: "storage_key"
                }
            );

        if (error) {
            console.error(`Could not sync ${key}:`, error.message);
        }
    }

    function scheduleUpload(key) {
        if (
            applyingRemoteData ||
            downloadingData ||
            !syncReady
        ) {
            return;
        }

        clearTimeout(uploadTimers.get(key));

        const timer = setTimeout(() => {
            uploadKey(key);
            uploadTimers.delete(key);
        }, 500);

        uploadTimers.set(key, timer);
    }

    function cancelPendingUploads() {
        uploadTimers.forEach(timer => clearTimeout(timer));
        uploadTimers.clear();
    }

    async function uploadMissingLocalData(remoteKeys) {
        for (const key of SYNC_KEYS) {
            if (
                !remoteKeys.has(key) &&
                localStorage.getItem(key)
            ) {
                await uploadKey(key);
            }
        }
    }

    async function downloadData() {
        if (!client || downloadingData) {
            return;
        }

        downloadingData = true;
        cancelPendingUploads();

        try {
            const { data, error } = await client
                .from(TABLE_NAME)
                .select("storage_key, data")
                .in("storage_key", SYNC_KEYS);

            if (error) {
                console.error(
                    "Could not load shared data:",
                    error.message
                );
                return;
            }

            const remoteKeys = new Set();

            (data || []).forEach(row => {
                remoteKeys.add(row.storage_key);
                writeLocalIfChanged(row.storage_key, row.data);
            });

            await uploadMissingLocalData(remoteKeys);

            window.dispatchEvent(
                new CustomEvent("fms-data-synced")
            );

            if (typeof window.renderAll === "function") {
                window.renderAll();
            }
        } finally {
            downloadingData = false;
        }
    }

    function installLocalStorageSync() {
        if (localStorage.__fmsSyncInstalled) {
            return;
        }

        const originalSetItem = localStorage.setItem.bind(localStorage);

        localStorage.setItem = (key, value) => {
            originalSetItem(key, value);

            if (
                SYNC_KEYS.includes(key) &&
                !applyingRemoteData &&
                !downloadingData
            ) {
                scheduleUpload(key);
            }
        };

        const originalRemoveItem =
            localStorage.removeItem.bind(localStorage);

        localStorage.removeItem = key => {
            originalRemoveItem(key);

            if (
                SYNC_KEYS.includes(key) &&
                !applyingRemoteData &&
                !downloadingData
            ) {
                scheduleUpload(key);
            }
        };

        Object.defineProperty(localStorage, "__fmsSyncInstalled", {
            value: true,
            configurable: false,
            enumerable: false
        });
    }

    async function startSync() {
        if (syncStarted) {
            return;
        }

        syncStarted = true;
        installLocalStorageSync();

        const connected = await createSupabaseClient();

        if (!connected) {
            return;
        }

        syncReady = true;
        await downloadData();

        // Upload changes made during application startup.
        for (const key of SYNC_KEYS) {
            await uploadKey(key);
        }
    }

    document.addEventListener("submit", event => {
        if (event.target.id !== "login-form") {
            return;
        }

        setTimeout(async () => {
            const connected = await createSupabaseClient();

            if (
                connected &&
                sessionStorage.getItem("fms_logged_in") === "true"
            ) {
                syncReady = true;
                await downloadData();
            }
        }, 700);
    });

    document.addEventListener("DOMContentLoaded", startSync);
})();
