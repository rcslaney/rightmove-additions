let modes = {
    "transit": "Public transport",
    "bicycling": "Cycling",
    "driving": "Driving",
    "walking": "Walking"
};

function sendMessage(extensionId, data) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(extensionId, data, response => {
            resolve(response);
        });
    });
}

(async () => {
    let extension_id = document.currentScript.getAttribute("data-extension-id");

    history.pushState = (f => function pushState() {
        var ret = f.apply(this, arguments);
        window.dispatchEvent(new Event('pushstate'));
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    })(history.pushState);

    history.replaceState = (f => function replaceState() {
        var ret = f.apply(this, arguments);
        window.dispatchEvent(new Event('replacestate'));
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    })(history.replaceState);

    window.addEventListener('popstate', () => {
        window.dispatchEvent(new Event('locationchange'))
    });

    if (window.location.pathname.startsWith("/properties/")) {
        // Code to insert directions into Rightmove page
        let elBefore = document.querySelector("[data-test='infoReel']").parentElement;
        let containerParent = elBefore.parentElement;

        let container = document.createElement("article");

        let prop = window.PAGE_MODEL.propertyData;

        const mapsResponse = await sendMessage(extension_id, { type: "getRoutes", payload: { lat: prop["location"]["latitude"], lng: prop["location"]["longitude"] } });

        mapsResponse.sort((a, b) => a.id < b.id ? 1 : -1);

        let transitInfo = "";

        for(let i = 0; i < mapsResponse.length; i++) {
            transitInfo += `<div class="route-title"><a href='https://www.google.com/maps/dir/?api=1&travelmode=${mapsResponse[i].location.mode}&origin=${mapsResponse[i].location.lat},${mapsResponse[i].location.lng}&destination=${prop.location.latitude},${prop.location.longitude}' target="_blank">${modes[mapsResponse[i].location.mode]} directions to ${mapsResponse[i].location.address}</a></div>`;

            transitInfo += `<div class="routes-container mode-${mapsResponse[i].location.mode}">`;

            if(mapsResponse[i].location.showAlternativeRoutes) {
                mapsResponse[i].routes.forEach(route => transitInfo += renderRoute(route, mapsResponse[i].location));
            } else {
                transitInfo += renderRoute(mapsResponse[i].routes[0], mapsResponse[i].location);
            }

            transitInfo += `</div>`;

            container.innerHTML = transitInfo;

            containerParent.insertBefore(container, elBefore.nextSibling);
        }

        if(await sendMessage(extension_id, { type : "getLayoutAdjustmentEnabled" })) {
            // Code to push property info (type, bedrooms, bathrooms) into sidebar
            let newContainer = document.querySelector("aside").firstChild.firstChild;

            newContainer.insertBefore(elBefore, newContainer.firstChild);

            document.querySelector("aside").innerHTML += " ";

            document.querySelector("aside").firstChild.firstChild.style.padding = "0";

            document.querySelector("aside").querySelector("dl").style.flexDirection = "column";
        }
    }

    function renderRoute(route, location) {
        if(location.mode == "transit") {
            let info = route["legs"][0];
            let steps = info["steps"];

            let mySteps = [];

            steps.forEach(step => {
                if (step.travel_mode == "WALKING") {
                    mySteps.push(`<img src="https://maps.gstatic.com/mapfiles/transit/iw2/7/walk.png"><div>${step["duration"]["text"]}</div>`)
                } else if (step.travel_mode == "TRANSIT") {
                    let icon = step["transit_details"]["line"]["vehicle"]["local_icon"] === undefined ? step["transit_details"]["line"]["vehicle"]["icon"] : step["transit_details"]["line"]["vehicle"]["local_icon"];

                    let stops = "(from " + step["transit_details"]["departure_stop"]["name"] + " to " + step["transit_details"]["arrival_stop"]["name"] + ")";
                    let title = `${step["transit_details"]["line"]["name"] !== undefined ? step["transit_details"]["line"]["name"] : step["transit_details"]["line"]["short_name"]} towards ${step["transit_details"]["headsign"]} ${stops}`;
                    mySteps.push(`<img src="${icon}" title="${title}"><div title="${title}">${step["duration"]["text"]}</div>`);
                }
            })

            return `<div class='divider'></div><div class="duration">${info.duration.text}</div>${mySteps.join("<div class='v-arrow'>&gt;</div>")}`.replaceAll("hour", "hr");
        } else if(location.mode == "driving") {
            let info = route["legs"][0];

            return `<div class='divider'></div><div class="duration">${info.duration.text}</div><div>${info.duration_in_traffic.text} with traffic</div><div>${info.distance.text}</div><div>${route.summary}</div>`.replaceAll("hour", "hr");
        } else if(location.mode == "bicycling") {
            let info = route["legs"][0];

            return `<div class='divider'></div><div class="duration">${info.duration.text}</div><div>${info.distance.text}</div><div>${route.summary}</div>`.replaceAll("hour", "hr");
        } else if(location.mode == "walking") {
            let info = route["legs"][0];
            
            return `<div class='divider'></div><div class="duration">${info.duration.text}</div><div>${info.distance.text}</div><div>${route.summary}</div>`.replaceAll("hour", "hr");
        }
    }
})();