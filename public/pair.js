document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("pair-form");
  if (!form) return;
  const button = document.getElementById("pair-submit");
  const result = document.getElementById("pair-result");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    button.textContent = "REQUESTING CODE...";
    result.textContent = "Contacting the bot service...";
    try {
      const response = await fetch("/api/pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          phoneNumber: document.getElementById("pair-phone").value.trim(),
          secret: document.getElementById("pair-secret").value
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not request a pairing code.");
      result.textContent = "Your WhatsApp pairing code: " + data.code;
    } catch (error) {
      result.textContent = error.message || "Request failed. Please try again.";
    } finally {
      button.disabled = false;
      button.textContent = "GET PAIRING CODE";
    }
  });
});