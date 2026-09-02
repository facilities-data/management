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
    let applyingRemoteData = false;
    let syncReady = false;
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
            console.error("Supabase initialization failed:", error.message);
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

    function writeLocal(key, value) {
        applyingRemoteData = true;

        try {
            localStorage.setItem(key, JSON.stringify(value));
        } finally {
            applyingRemoteData = false;
        }
    }

    async function uploadKey(key) {
        if (!client || !syncReady || applyingRemoteData) {
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
        clearTimeout(uploadTimers.get(key));

        const timer = setTimeout(() => {
            uploadKey(key);
            uploadTimers.delete(key);
        }, 500);

        uploadTimers.set(key, timer);
    }

    async function uploadAllLocalData() {
        for (const key of SYNC_KEYS) {
            if (localStorage.getItem(key)) {
                await uploadKey(key);
            }
        }
    }

    async function downloadData() {
        if (!client) {
            return;
        }

        const { data, error } = await client
            .from(TABLE_NAME)
            .select("storage_key, data")
            .in("storage_key", SYNC_KEYS);

        if (error) {
            console.error("Could not load shared data:", error.message);
            return;
        }

        const remoteKeys = new Set();

        (data || []).forEach(row => {
            remoteKeys.add(row.storage_key);
            writeLocal(row.storage_key, row.data);
        });

        // Upload local records only for keys that do not exist remotely.
        for (const key of SYNC_KEYS) {
            if (!remoteKeys.has(key) && localStorage.getItem(key)) {
                await uploadKey(key);
            }
        }

        window.dispatchEvent(new CustomEvent("fms-data-synced"));

        if (typeof window.renderAll === "function") {
            window.renderAll();
        }
    }

    function installLocalStorageSync() {
        const originalSetItem = localStorage.setItem.bind(localStorage);

        localStorage.setItem = (key, value) => {
            originalSetItem(key, value);

            if (SYNC_KEYS.includes(key)) {
                scheduleUpload(key);
            }
        };

        const originalRemoveItem = localStorage.removeItem.bind(localStorage);

        localStorage.removeItem = key => {
            originalRemoveItem(key);

            if (SYNC_KEYS.includes(key)) {
                scheduleUpload(key);
            }
        };
    }

    async function startSync() {
        installLocalStorageSync();

        const connected = await createSupabaseClient();

        if (!connected) {
            return;
        }

        // Enable syncing before loading data so local records can be uploaded.
        syncReady = true;

        await downloadData();

        // Upload any local records created during application startup.
        await uploadAllLocalData();
    }

    document.addEventListener("submit", event => {
        if (event.target.id !== "login-form") {
            return;
        }

        setTimeout(async () => {
            if (!client) {
                await createSupabaseClient();
            }

            if (
                client &&
                sessionStorage.getItem("fms_logged_in") === "true"
            ) {
                syncReady = true;
                await downloadData();
                await uploadAllLocalData();
            }
        }, 700);
    });

    document.addEventListener("DOMContentLoaded", startSync);
})();
