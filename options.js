const sleep = ms => new Promise(r => setTimeout(r, ms));

customElements.define("location-chooser",
    class extends HTMLElement {
        lat = null;
        lng = null;

        constructor() {
            super();

            let locationChooser = document.getElementById("location-chooser-template").content;

            this.attachShadow({ mode: "open" })
            this.shadowRoot.appendChild(locationChooser.cloneNode(true));

            // Apply external styles to the shadow DOM
            const linkElem = document.createElement("link");
            linkElem.setAttribute("rel", "stylesheet");
            linkElem.setAttribute("href", "options.css");

            fillTimeSelect(this.shadowRoot.querySelector(".time"));

            this.shadowRoot.querySelector("button").addEventListener("click", this.handleDelete);
            this.shadowRoot.querySelector(".address").addEventListener("input", this.handleAddressInput);
            this.shadowRoot.querySelector(".time").addEventListener("change", this.saveState);
            this.shadowRoot.querySelector(".mode").addEventListener("change", this.saveState);
            this.shadowRoot.querySelector(".show-alternative-routes").addEventListener("change", this.saveState);

            // Attach the created element to the shadow DOM
            this.shadowRoot.appendChild(linkElem);
        }

        async connectedCallback() {
            let result = await chrome.storage.sync.get(["locations"]);

            if(!("locations" in result)) return;

            let data = result.locations.filter(location => location.id == this.getAttribute("id"))[0];

            if(!data) return;

            this.shadowRoot.querySelector(".address").value = data["address"];
            this.shadowRoot.querySelector(".time").value = data["time"];
            this.shadowRoot.querySelector(".mode").value = data["mode"];
            this.shadowRoot.querySelector(".show-alternative-routes").checked = data["showAlternativeRoutes"];

            if(data["lat"] != null) {
                this.shadowRoot.querySelector(".commuting-map").src = await this.getMapImageURL(data["lat"], data["lng"]);
                this.lat = data["lat"];
                this.lng = data["lng"];
            }
        }

        handleDelete = async () => {
            let currentEntries = (await chrome.storage.sync.get("locations")).locations;

            let filtered = currentEntries.filter(location => location.id != this.getAttribute("id"));

            await chrome.storage.sync.set({ locations: filtered });

            this.style.height = this.offsetHeight + 16;
            this.offsetHeight;
            this.style.height = 0;
            await sleep(500);
            this.remove();
        }

        handleAddressInput = async (e) => {
            let params = new URLSearchParams({
                input: e.target.value,
                key: (await chrome.storage.sync.get(["apikey"])).apikey
            });

            let result = await fetch("https://maps.googleapis.com/maps/api/place/autocomplete/json?" + params.toString());
            let data = await result.json();

            let predictions = document.createElement("div");

            predictions.className = "dropdown";

            for (let i = 0; i < data["predictions"].length; i++) {
                let prediction = data["predictions"][i];

                let html_name = prediction["description"];

                for (let i = prediction["matched_substrings"].length - 1; i >= 0; i--) {
                    let match = prediction["matched_substrings"][i];

                    let start = match["offset"];
                    let end = match["offset"] + match["length"];

                    html_name = html_name.substring(0, start) + "<b>" + html_name.substring(start, end) + "</b>" + html_name.substring(end);
                }

                let el = document.createElement("div");

                el.innerHTML = html_name;

                el.addEventListener("click", () => {
                    this.shadowRoot.querySelector(".address").value = el.innerText;

                    this.handleSelectedPrediction(prediction["place_id"])
                });

                predictions.append(el);
            }

            this.shadowRoot.querySelector(".dropdown").replaceWith(predictions);
        }

        handleSelectedPrediction = async (place_id) => {
            let params = new URLSearchParams({
                place_id: place_id,
                key: (await chrome.storage.sync.get(["apikey"])).apikey
            });
        
            let result = await fetch("https://maps.googleapis.com/maps/api/place/details/json?" + params.toString());
            let data = await result.json();
        
            let location = data["result"]["geometry"]["location"];

            this.lat = location["lat"];
            this.lng = location["lng"];
        
            this.shadowRoot.querySelector(".commuting-map").src = await this.getMapImageURL(location["lat"], location["lng"]);

            this.saveState();
        }

        async getMapImageURL(lat, lng) {
            let params = new URLSearchParams({
                center: lat + "," + lng,
                markers: lat + "," + lng,
                zoom: 17,
                size: "320x320",
                key: (await chrome.storage.sync.get(["apikey"])).apikey
            });

            return "https://maps.googleapis.com/maps/api/staticmap?" + params.toString();
        }

        saveState = async () => {
            let data = {
                id: this.getAttribute("id"),
                address: this.shadowRoot.querySelector(".address").value,
                lat: this.lat,
                lng: this.lng,
                time: this.shadowRoot.querySelector(".time").value,
                mode: this.shadowRoot.querySelector(".mode").value,
                showAlternativeRoutes: this.shadowRoot.querySelector(".show-alternative-routes").checked
            };

            let currentEntries = (await chrome.storage.sync.get("locations")).locations;

            let entry = currentEntries.filter(location => location.id == data.id)[0];

            if(entry) {
                Object.assign(entry, data);
            } else {
                currentEntries.push(data);
            }

            await chrome.storage.sync.set({ locations: currentEntries });
        }
    }
)

async function submitApiKey() {
    let apiKey = document.querySelector("#api-key").value;

    let result = await checkApiKey(apiKey);

    let el = document.querySelector("#api-key-validation");

    if (result.valid) {
        el.classList.add("success");
        el.classList.remove("error");
        el.innerText = "API key is valid, saved."

        await chrome.storage.sync.set({ apikey: document.querySelector(".api-key").value });
    } else {
        el.classList.remove("success");
        el.classList.add("error");
        el.innerText = result.data["error_message"];
    }
}

let apiKeyValidityCache = {};

async function checkApiKey(apiKey) {
    if(!(apiKey in apiKeyValidityCache)) {
        let params = new URLSearchParams({
            input: "th",
            key: apiKey
        });

        let result = await fetch("https://maps.googleapis.com/maps/api/place/autocomplete/json?" + params.toString());
        let data = await result.json();

        apiKeyValidityCache[apiKey] = {
            valid: data["status"] == "OK",
            data: data
        };
    }

    return apiKeyValidityCache[apiKey];
}

function fillTimeSelect(el) {
    for (let i = 0; i < 24; i++) {
        let opt0 = document.createElement("option");
        opt0.innerText = i + ":00";
        opt0.value = i * 60 * 60 * 1000;

        if (i == 9) {
            opt0.selected = "selected";
        }

        let opt1 = document.createElement("option");
        opt1.innerText = i + ":30";
        opt1.value = (i + 0.5) * 60 * 60 * 1000;
        el.appendChild(opt0);
        el.appendChild(opt1);
    }
}

async function addAnother() {
    if(!(await checkApiKey((await chrome.storage.sync.get(["apikey"])).apikey)).valid) {
        alert("Must have a valid Google maps API key before adding locations.");
        return;
    }

    let container = document.querySelector("#location-choosers");

    let newEl = document.createElement("location-chooser");

    let maxID = -1;

    (await chrome.storage.sync.get("locations")).locations.forEach(location => maxID = Math.max(maxID, location.id));

    newEl.id = maxID + 1;

    if (document.querySelector("location-chooser")) {
        window.__location_chooser_height__ = document.querySelector("location-chooser").offsetHeight;
    }

    if (window.__location_chooser_height__) {
        newEl.style.height = 0;
        newEl.offsetHeight;
        container.appendChild(newEl);
    } else {
        newEl.style.position = "absolute";
        newEl.style.visibility = "hidden";
        newEl.className = "show";
        container.appendChild(newEl);
        await sleep(10);
        window.__location_chooser_height__ = newEl.offsetHeight;
        newEl.className = "";
        newEl.style.height = 0;
        newEl.style.position = "";
        newEl.style.visibility = "";
        newEl.offsetHeight;
    }

    newEl.offsetHeight;

    setTimeout(e => {
        newEl.className = "show";
        newEl.offsetHeight;
        newEl.style.height = window.__location_chooser_height__;
    }, 0);
}

document.querySelector("#add-another").addEventListener("click", addAnother);
document.querySelector("#api-key-save").addEventListener("click", submitApiKey);

chrome.storage.sync.get(["apikey"]).then(result => {
    document.querySelector(".api-key").value = result.apikey ?? "";
});

chrome.storage.sync.get(["layoutadjustment"]).then(result => {
    document.querySelector(".layout-adjustment").checked = result.layoutadjustment ?? false;
});

document.querySelector(".layout-adjustment").addEventListener("change", async e => {
    await chrome.storage.sync.set({ layoutadjustment: document.querySelector(".layout-adjustment").checked });
});


chrome.storage.sync.get("locations").then(result => {
    if(!("locations" in result)) {
        result = { locations: [] };

        chrome.storage.sync.set(result);
    }

    result.locations.forEach(e => {
        let container = document.querySelector("#location-choosers");

        let newEl = document.createElement("location-chooser");

        newEl.className = "show";
        newEl.id = e.id;

        container.appendChild(newEl);
    });
});