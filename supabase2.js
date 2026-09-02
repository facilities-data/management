(() => {
    const SUPABASE_CDN =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    function loadSupabaseLibrary() {
        if (window.supabase?.createClient) {
            return Promise.resolve();
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

    window.supabaseLibraryReady = loadSupabaseLibrary()
        .then(() => {
            console.log("Supabase library loaded.");
        })
        .catch(error => {
            console.error("Supabase library was not loaded:", error.message);
        });
})();