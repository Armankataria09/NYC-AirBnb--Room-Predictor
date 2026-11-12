const form = document.getElementById("predictionForm");
const predictButton = document.getElementById("predictButton");
const formMessage = document.getElementById("formMessage");
const statusDot = document.getElementById("statusDot");
const apiStatus = document.getElementById("apiStatus");
const connectionLabel = document.getElementById("connectionLabel");
const apiUrlInput = document.getElementById("apiUrl");
const emptyState = document.getElementById("emptyState");
const predictionOutput = document.getElementById("predictionOutput");

function baseUrl() {
  return apiUrlInput.value.trim().replace(/\/+$/, "");
}
function setConnection(online, message) {
  statusDot.className = online ? "online" : "offline";
  apiStatus.textContent = message;
  connectionLabel.textContent = online ? "Connected" : "Unavailable";
  connectionLabel.style.color = online ? "#1a9b72" : "#c47765";
}
async function checkApi() {
  const url = baseUrl();
  if (!url) {
    setConnection(false, "Enter backend URL");
    return false;
  }
  try {
    // The FastAPI root route is used as a lightweight availability check.
    const response = await fetch(`${url}/`, { method: "GET" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setConnection(true, "API connected");
    return true;
  } catch (error) {
    setConnection(false, "API not reachable");
    return false;
  }
}
document.getElementById("checkApi").addEventListener("click", checkApi);
apiUrlInput.addEventListener("change", checkApi);

function showMessage(message) {
  formMessage.textContent = message || "";
}
function numberValue(data, key) {
  const value = Number(data.get(key));
  if (!Number.isFinite(value)) throw new Error(`Please enter a valid value for ${key.replaceAll("_", " ")}.`);
  return value;
}
function buildPayload(data) {
  const payload = {
    latitude: numberValue(data, "latitude"),
    longitude: numberValue(data, "longitude"),
    price: numberValue(data, "price"),
    minimum_nights: numberValue(data, "minimum_nights"),
    number_of_reviews: numberValue(data, "number_of_reviews"),
    reviews_per_month: numberValue(data, "reviews_per_month"),
    calculated_host_listings_count: numberValue(data, "calculated_host_listings_count"),
    availability_365: numberValue(data, "availability_365"),
    neighbourhood_group: String(data.get("neighbourhood_group")).trim(),
    neighbourhood: String(data.get("neighbourhood")).trim()
  };
  const checks = [
    [payload.latitude >= -90 && payload.latitude <= 90, "Latitude must be between -90 and 90."],
    [payload.longitude >= -180 && payload.longitude <= 180, "Longitude must be between -180 and 180."],
    [payload.price > 0, "Price must be greater than zero."],
    [Number.isInteger(payload.minimum_nights) && payload.minimum_nights >= 1 && payload.minimum_nights <= 365, "Minimum nights must be a whole number from 1 to 365."],
    [Number.isInteger(payload.number_of_reviews) && payload.number_of_reviews >= 0, "Number of reviews must be a non-negative whole number."],
    [payload.reviews_per_month >= 0, "Reviews per month cannot be negative."],
    [Number.isInteger(payload.calculated_host_listings_count) && payload.calculated_host_listings_count >= 0, "Host listings must be a non-negative whole number."],
    [Number.isInteger(payload.availability_365) && payload.availability_365 >= 0 && payload.availability_365 <= 365, "Availability must be a whole number from 0 to 365."],
    [payload.neighbourhood_group.length > 0, "Neighbourhood group is required."],
    [payload.neighbourhood.length > 0, "Neighbourhood is required."]
  ];
  const failed = checks.find(([valid]) => !valid);
  if (failed) throw new Error(failed[1]);
  return payload;
}

function renderResult(result) {
  if (!result || !("predicted_room_type" in result)) {
    throw new Error("The API response is missing 'predicted_room_type'. Check your FastAPI response format.");
  }
  document.getElementById("predictedType").textContent = String(result.predicted_room_type);
  const probs = Array.isArray(result.probability) ? result.probability : [];
  const labels = Array.isArray(result.class_labels) ? result.class_labels : [];
  const list = document.getElementById("probabilityList");
  list.innerHTML = "";
  if (probs.length) {
    const normalized = probs.map((value, index) => ({
      label: labels[index] !== undefined ? String(labels[index]) : `Class ${index + 1}`,
      value: Number(value)
    })).filter(item => Number.isFinite(item.value));
    normalized.sort((a, b) => b.value - a.value);
    normalized.forEach(item => {
      const percent = Math.max(0, Math.min(100, item.value * 100));
      const row = document.createElement("div");
      row.className = "probability-item";
      const label = document.createElement("div");
      label.className = "probability-label";
      const name = document.createElement("span");
      name.textContent = item.label;
      const value = document.createElement("b");
      value.textContent = `${percent.toFixed(1)}%`;
      label.append(name, value);
      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.width = `${percent}%`;
      track.append(fill);
      row.append(label, track);
      list.append(row);
    });
    const top = normalized[0];
    document.getElementById("confidenceSummary").textContent = top ? `${(top.value * 100).toFixed(1)}% top class` : "Model output";
  } else {
    list.textContent = "Probability values were not returned by the API.";
    document.getElementById("confidenceSummary").textContent = "Unavailable";
  }
  emptyState.classList.add("hidden");
  predictionOutput.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  let payload;
  try {
    payload = buildPayload(new FormData(form));
  } catch (error) {
    showMessage(error.message);
    return;
  }

  predictButton.disabled = true;
  predictButton.querySelector(".button-label").textContent = "Predicting…";
  predictButton.querySelector(".button-arrow").textContent = "···";
  try {
    const response = await fetch(`${baseUrl()}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    });
    const raw = await response.text();
    let result;
    try { result = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error(`Backend returned an unreadable response (HTTP ${response.status}).`); }
    if (!response.ok) {
      const detail = result.detail;
      const message = Array.isArray(detail) ? detail.map(item => `${item.loc?.join(".")}: ${item.msg}`).join("; ") : (detail || `HTTP ${response.status}`);
      throw new Error(message);
    }
    renderResult(result);
    setConnection(true, "API connected");
  } catch (error) {
    showMessage(error.message.includes("Failed to fetch")
      ? "Could not reach FastAPI. Start the backend and check the Backend URL and CORS settings."
      : error.message);
    setConnection(false, "API not reachable");
  } finally {
    predictButton.disabled = false;
    predictButton.querySelector(".button-label").textContent = "Predict room type";
    predictButton.querySelector(".button-arrow").textContent = "↗";
  }
});

form.addEventListener("reset", () => {
  showMessage("");
  predictionOutput.classList.add("hidden");
  emptyState.classList.remove("hidden");
});
window.addEventListener("load", checkApi);
