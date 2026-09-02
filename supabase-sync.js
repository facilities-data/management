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
    let realtimeChannel = null;
    let pollingTimer = null;

    const uploadTimers = new Map();

    function logStatus(message, error = null) {
        if (error) {
            console.error(`[FMS sync] ${message}`, error);
        } else {
            console.log(`[FMS sync] ${message}`);
        }

        window.dispatchEvent(
            new CustomEvent("fms-sync-status", {
                detail: {
                    message,
                    error: error?.message || ""
                }
            })
        );
    }

    function loadSupabaseLibrary() {
        if (window.supabase?.createClient) {
            return Promise.resolve();
        }

        if (window.supabaseLibraryReady) {
            return window.supabaseLibraryReady;
        }

        window.supabaseLibraryReady = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(
                `script[src="${SUPABASE_CDN}"]`
            );

            if (existingScript) {
                existingScript.addEventListener("load", resolve, {
                    once: true
                });

                existingScript.addEventListener(
                    "error",
                    () => reject(new Error("Supabase CDN failed to load.")),
                    { once: true }
                );

                return;
            }

            const script = document.createElement("script");
            script.src = SUPABASE_CDN;

            script.onload = () => {
                if (window.supabase?.createClient) {
                    resolve();
                } else {
                    reject(new Error("Supabase library is unavailable."));
                }
            };

            script.onerror = () =>
                reject(new Error("Supabase CDN failed to load."));

            document.head.appendChild(script);
        });

        return window.supabaseLibraryReady;
    }

    async function createSupabaseClient() {
        if (client) {
            return true;
        }

        try {
            await loadSupabaseLibrary();

            client = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );

            logStatus("Supabase client connected.");
            return true;
        } catch (error) {
            logStatus("Supabase initialization failed.", error);
            return false;
        }
    }

    function readLocal(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return value;
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

    async function uploadKey(key, attempt = 1) {
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

        if (!error) {
            logStatus(`Uploaded ${key}.`);
            return;
        }

        logStatus(`Could not upload ${key}.`, error);

        if (attempt < 3) {
            setTimeout(() => uploadKey(key, attempt + 1), attempt * 1500);
        }
    }

    function scheduleUpload(key) {
        if (
            !syncReady ||
            applyingRemoteData ||
            downloadingData
        ) {
            return;
        }

        clearTimeout(uploadTimers.get(key));

        const timer = setTimeout(() => {
            uploadTimers.delete(key);
            uploadKey(key);
        }, 500);

        uploadTimers.set(key, timer);
    }

    function cancelPendingUploads() {
        uploadTimers.forEach(timer => clearTimeout(timer));
        uploadTimers.clear();
    }

    async function uploadMissingLocalData(remoteKeys) {
        const missingKeys = SYNC_KEYS.filter(key =>
            !remoteKeys.has(key) &&
            localStorage.getItem(key)
        );

        for (const key of missingKeys) {
            await uploadKey(key);
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
                .select("storage_key, data, updated_at")
                .in("storage_key", SYNC_KEYS);

            if (error) {
                logStatus("Could not download shared data.", error);
                return;
            }

            const remoteKeys = new Set();

            (data || []).forEach(row => {
                if (!SYNC_KEYS.includes(row.storage_key)) {
                    return;
                }

                remoteKeys.add(row.storage_key);
                writeLocalIfChanged(row.storage_key, row.data);
            });

            await uploadMissingLocalData(remoteKeys);

            window.dispatchEvent(new CustomEvent("fms-data-synced"));

            if (typeof window.renderAll === "function") {
                window.renderAll();
            }

            logStatus("Shared data synchronized.");
        } finally {
            downloadingData = false;
        }
    }

    function startRealtimeSync() {
        if (!client || realtimeChannel) {
            return;
        }

        realtimeChannel = client
            .channel("fms-browser-storage-sync")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: TABLE_NAME
                },
                payload => {
                    const changedKey =
                        payload.new?.storage_key ||
                        payload.old?.storage_key;

                    if (SYNC_KEYS.includes(changedKey)) {
                        logStatus(`Realtime update received for ${changedKey}.`);
                        downloadData();
                    }
                }
            )
            .subscribe(status => {
                logStatus(`Realtime status: ${status}`);

                if (status === "SUBSCRIBED") {
                    stopPolling();
                }

                if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT" ||
                    status === "CLOSED"
                ) {
                    startPolling();
                }
            });
    }

    function startPolling() {
        if (pollingTimer) {
            return;
        }

        logStatus("Polling fallback enabled.");

        pollingTimer = setInterval(() => {
            if (syncReady && !document.hidden) {
                downloadData();
            }
        }, 5000);
    }

    function stopPolling() {
        if (!pollingTimer) {
            return;
        }

        clearInterval(pollingTimer);
        pollingTimer = null;
        logStatus("Polling fallback disabled.");
    }

    function installLocalStorageSync() {
        if (localStorage.__fmsSyncInstalled) {
            return;
        }

        const originalSetItem = localStorage.setItem.bind(localStorage);
        const originalRemoveItem = localStorage.removeItem.bind(localStorage);

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
            syncStarted = false;
            startPolling();
            return;
        }

        syncReady = true;

        await downloadData();
        startRealtimeSync();

        if (!realtimeChannel) {
            startPolling();
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
                startRealtimeSync();
                startPolling();
            }
        }, 700);
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && syncReady) {
            downloadData();
        }
    });

    document.addEventListener("DOMContentLoaded", startSync);
})();
