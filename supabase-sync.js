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
    let uploadTimer = null;

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
                throw new Error(
                    "Supabase library was not loaded. Check the CDN connection."
                );
            }

            client = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );
        } catch (error) {
            console.error("Supabase initialization failed:", error.message);
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
        clearTimeout(uploadTimer);

        uploadTimer = setTimeout(() => {
            uploadKey(key);
        }, 400);
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

            if (SYNC_KEYS.includes(key) && syncReady) {
                scheduleUpload(key);
            }
        };
    }

    async function initializeSync() {
        installLocalStorageSync();
        await createSupabaseClient();

        await new Promise(resolve => setTimeout(resolve, 300));

        if (sessionStorage.getItem("fms_logged_in") === "true") {
            await downloadData();
            syncReady = true;
        }
    }

    document.addEventListener("submit", event => {
        if (event.target.id !== "login-form") {
            return;
        }

        setTimeout(async () => {
            if (!client) {
                await createSupabaseClient();
            }

            if (client && sessionStorage.getItem("fms_logged_in") === "true") {
                await downloadData();
                syncReady = true;
            }
        }, 500);
    });

    document.addEventListener("DOMContentLoaded", initializeSync);
})();