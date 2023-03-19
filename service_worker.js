async function calculateRoutes(latA, lngA, latB, lngB, mode, timeOffset) {
    var depTime = nextWednesday();
    depTime.setHours(0);
    depTime.setMinutes(0);
    depTime.setSeconds(0);
    depTime.setMilliseconds(0);

    depTime = new Date(depTime.getTime() + parseInt(timeOffset));

    let params = new URLSearchParams({
        origin: latA + "," + lngA,
        destination: latB + "," + lngB,
        departure_time: Math.floor(depTime.valueOf() / 1000),
        alternatives: true,
        mode: mode,
        units: "imperial",
        key: (await chrome.storage.sync.get(["apikey"])).apikey
    });

    let result = await fetch("https://maps.googleapis.com/maps/api/directions/json?" + params.toString());
    let data = await result.json();

    return data;
}

async function calculateRoutesForAllLocations(lat, lng) {
    let locations = (await chrome.storage.sync.get("locations")).locations;

    if(locations) {
        let results = [];

        await Promise.all(locations.map(async location => {
            results.push({...await calculateRoutes(location.lat, location.lng, lat, lng, location.mode, location.time), location: location});
        }));

        return results;
    } else {
        return [];
    }
}

function nextWednesday() {
    let now = new Date();
    let offset = (10 - now.getDay()) % 7;
    now.setDate(now.getDate() + offset)
    return now;
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message["type"] === 'getRoutes') {
        calculateRoutesForAllLocations(message["payload"]["lat"], message["payload"]["lng"])
            .then(data => {
                sendResponse(data);
            })
        return true;
    } else if (message["type"] === 'getLayoutAdjustmentEnabled') {
        chrome.storage.sync.get(["layoutadjustment"]).then(result => sendResponse(result.layoutadjustment));
        
        return true;
    }
});
