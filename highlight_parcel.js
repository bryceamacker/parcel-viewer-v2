// --- Initialize array to store multiple highlight handles ---
if (!window._parcelHighlightHandles) {
    window._parcelHighlightHandles = [];
    console.log("Initialized _parcelHighlightHandles array.");
}

// This script runs in the page context (not extension context)
async function highlightParcelByParcelId(parcelId) {
    console.log('Highlighting parcel:', parcelId);
    try {
        // Access the map view manager and highlight the parcel
        // This can access page-level objects like _mapViewManager that extension can't directly access
        let mapView = null;
        const mapWidgetId = 'widget_1';
        if (!mapView && _mapViewManager) {
            if (typeof _mapViewManager.getActiveJimuMapView === 'function') { mapView = _mapViewManager.getActiveJimuMapView(); }
            if (!mapView && _mapViewManager.jimuMapViewGroups) {
                 const group = _mapViewManager.jimuMapViewGroups[mapWidgetId];
                 mapView = group?.getActiveJimuMapView ? group.getActiveJimuMapView() : group?.jimuMapView;
            }
            if (mapView && mapView.view) { mapView = mapView.view; }
            if (mapView?.declaredClass !== 'esri.views.MapView') { mapView = null;}
            if(mapView) console.log("MapView found via _mapViewManager");
       }

       console.log("SUCCESS: MapView instance obtained:", mapView);

       // --- Find the Parcel FeatureLayer ---
       const parcelLayerTitle = "Parcels Identify"; // **VERIFY THIS TITLE**
       const parcelLayerUrl = "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Parcels_view/FeatureServer/0";
       const parcelIdFieldName = "STANPAR"; // **VERIFY THIS FIELD NAME**

       let parcelLayer = mapView.map.allLayers.find(layer => layer.title === parcelLayerTitle && layer.type === 'feature');

       if (!parcelLayer) {
           console.log(`Layer with title "${parcelLayerTitle}" not found. Trying URL...`);
           parcelLayer = mapView.map.allLayers.find(layer =>
               layer.type === 'feature' && layer.url && layer.url.toLowerCase() === parcelLayerUrl.toLowerCase()
           );
       }

       if (!parcelLayer) {
           console.error(`Could not find FeatureLayer using title "${parcelLayerTitle}" or URL: ${parcelLayerUrl}.`);
           console.log("Available layers:", mapView.map.allLayers.map(l => ({ id: l.id, title: l.title, url: l.url, type: l.type })).toArray());
           return;
       }
       console.log("Parcel FeatureLayer found:", parcelLayer);

       // --- Query for the OBJECTID ---
       console.log(`Querying for OBJECTID where ${parcelIdFieldName} = '${parcelId}'...`);
       let objectIdToHighlight = null;
       let featureGeometry = null;
       try {
           const query = parcelLayer.createQuery();
           query.where = `UPPER(${parcelIdFieldName}) = UPPER('${parcelId.replace("'", "''")}')`;
           query.outFields = ["OBJECTID"];
           query.returnGeometry = true; // Get geometry for zooming now
           query.outSpatialReference = mapView.spatialReference;
           query.num = 1;

           const results = await parcelLayer.queryFeatures(query);

           if (results.features.length > 0) {
               objectIdToHighlight = results.features[0].attributes.OBJECTID;
               featureGeometry = results.features[0].geometry; // Store geometry
               console.log(`Found OBJECTID: ${objectIdToHighlight} for Parcel ID: ${parcelId}`);
           } else {
               console.error(`No parcel found with ${parcelIdFieldName} = '${parcelId}'`);
               alert(`Parcel ID "${parcelId}" not found.`);
               return;
           }
       } catch (queryError) {
           console.error(`Error querying for Parcel ID ${parcelId}:`, queryError);
           alert(`Error searching for Parcel ID "${parcelId}". Check console.`);
           return;
       }

       // --- Get the FeatureLayerView ---
       console.log("Waiting for LayerView...");
       const parcelLayerView = await mapView.whenLayerView(parcelLayer);
       if (!parcelLayerView) {
           console.error("Could not get FeatureLayerView for the parcel layer.");
           return;
       }
       console.log("Parcel FeatureLayerView found:", parcelLayerView);

       // --- Highlight the Feature using the found OBJECTID ---
       console.log(`Applying highlight to OBJECTID: ${objectIdToHighlight}...`);
       // Add the new highlight handle to the array
       const newHighlightHandle = parcelLayerView.highlight(objectIdToHighlight);
       window._parcelHighlightHandles.push(newHighlightHandle); // STORE IN ARRAY
       console.log(`Highlight applied. Total highlights: ${window._parcelHighlightHandles.length}`);

       // --- Optional: Zoom to the highlighted feature ---
       if (featureGeometry) {
            console.log("Zooming to feature...");
            mapView.goTo(featureGeometry.extent.expand(1.5))
               .then(() => console.log("Zoomed to feature."))
               .catch(err => console.warn("Could not zoom to feature:", err));
       } else {
            console.warn(`Geometry not available for OBJECTID ${objectIdToHighlight} to zoom.`);
       }

    } catch (error) {
        console.error('Error in highlightParcelByParcelId:', error);
        return false;
    }
}

// Listen for messages from the content script
window.addEventListener('message', function(event) {
    // Verify the sender - only accept messages from the same window
    if (event.source !== window) return;
    
    // Check if this is our highlight message
    if (event.data.type === 'HIGHLIGHT_PARCEL' && event.data.parcelId) {
        highlightParcelByParcelId(event.data.parcelId);
    }
}, false);

console.log('Parcel highlight script loaded and ready');

function clearAllParcelHighlights() {
    if (window._parcelHighlightHandles && window._parcelHighlightHandles.length > 0) {
        console.log(`Clearing ${window._parcelHighlightHandles.length} parcel highlights...`);
        window._parcelHighlightHandles.forEach(handle => {
            if (handle && typeof handle.remove === 'function') {
                handle.remove();
            }
        });
        window._parcelHighlightHandles = []; // Clear the array
        console.log("All parcel highlights cleared.");
    } else {
        console.log("No active parcel highlights to clear.");
    }
}

console.log("highlightParcelByParcelId(parcelId) now supports multiple highlights.");
console.log("Use clearAllParcelHighlights() to remove all highlights added by this script.");

// --- Usage Example ---
// highlightParcelByParcelId('142160C02500CO'); // Highlight first parcel
// highlightParcelByParcelId('14200032200'); // Highlight second parcel (first remains)
// clearAllParcelHighlights(); // Clear both highlights