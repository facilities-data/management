document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const loginError = document.getElementById("login-error");

    if (!loginForm || !window.supabaseClient) {
        console.error("Supabase or login form is unavailable.");
        return;
    }

    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        const email = document
            .getElementById("login-username")
            .value
            .trim();

        const password = document.getElementById("login-password").value;

        loginError.classList.remove("visible");
        loginError.textContent = "";

        const { error } = await window.supabaseClient.auth
            .signInWithPassword({
                email,
                password
            });

        if (error) {
            console.error("Login error:", error);
            loginError.textContent = error.message;
            loginError.classList.add("visible");
            return;
        }

        window.location.reload();
    });
});