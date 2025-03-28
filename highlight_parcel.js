// --- Initialize array to store multiple highlight handles ---
if (!window._parcelHighlightHandles) {
    window._parcelHighlightHandles = [];
    console.log("Initialized _parcelHighlightHandles array.");
}

async function highlightParcelByParcelId(parcelId) {
    console.log(`Attempting to highlight parcel with Parcel ID (STANPAR): ${parcelId}`);
    if (!parcelId || typeof parcelId !== 'string' || parcelId.trim() === '') {
        console.error("Invalid parcelId provided. It must be a non-empty string.");
        return;
    }
    if (parcelId.includes("'")) {
         console.error("Parcel ID contains a single quote, which is not supported by this simple script. Please remove it.");
         return;
    }

    let mapView = null;
    const mapWidgetId = 'widget_1';

    // --- Re-using the successful MapView finding logic (condensed) ---
    try {
        if (!mapView && window.jimuCore?.widgetManager) {
             mapView = window.jimuCore.widgetManager.getWidget(mapWidgetId)?.instance?.view;
             if(mapView) console.log("MapView found via jimuCore.widgetManager");
        }
        if (!mapView && window.$arcgis?.views) {
             const viewsObject = window.$arcgis.views;
             if (viewsObject && typeof viewsObject === 'object') {
                 if (viewsObject.declaredClass === 'esri.views.MapView') { mapView = viewsObject; }
                 else if (Array.isArray(viewsObject) && viewsObject.length > 0 && viewsObject[0].declaredClass === 'esri.views.MapView') { mapView = viewsObject[0]; }
                 else if (viewsObject[mapWidgetId]?.declaredClass === 'esri.views.MapView') { mapView = viewsObject[mapWidgetId]; }
                 else { mapView = Object.values(viewsObject).find(v => v && v.declaredClass === 'esri.views.MapView'); }
             }
             if(mapView) console.log("MapView found via $arcgis.views");
        }
        if (!mapView && window._mapViewManager) {
             if (typeof window._mapViewManager.getActiveJimuMapView === 'function') { mapView = window._mapViewManager.getActiveJimuMapView(); }
             if (!mapView && window._mapViewManager.jimuMapViewGroups) {
                  const group = window._mapViewManager.jimuMapViewGroups[mapWidgetId];
                  mapView = group?.getActiveJimuMapView ? group.getActiveJimuMapView() : group?.jimuMapView;
             }
             if (mapView && mapView.view) { mapView = mapView.view; }
             if (mapView?.declaredClass !== 'esri.views.MapView') { mapView = null;}
             if(mapView) console.log("MapView found via _mapViewManager");
        }
        if (!mapView && window._widgetManager) {
             mapView = window._widgetManager.getWidget(mapWidgetId)?.view;
             if(mapView) console.log("MapView found via _widgetManager");
        }
        if (!mapView && window._appStore) {
            const state = window._appStore.getState();
            mapView = state?.widgetsRuntimeInfo?.[mapWidgetId]?.instance?.view;
             if(mapView) console.log("MapView found via _appStore");
        }
         if (!mapView && window.jimuStore) { // Checking alternate name if _appStore doesn't exist
            const state = window.jimuStore.getState();
            mapView = state?.widgetsRuntimeInfo?.[mapWidgetId]?.instance?.view;
             if(mapView) console.log("MapView found via jimuStore");
        }
        if (!mapView && window.require) {
             await new Promise((resolve, reject) => {
                 window.require(['esri/views/MapView'], (MapView) => {
                     if (MapView && MapView.instances && MapView.instances.length > 0) {
                        mapView = MapView.instances[0];
                         console.log("MapView found via require MapView.instances"); resolve();
                     } else { reject(); }
                 }, reject);
             });
         }

        if (!mapView || mapView.declaredClass !== 'esri.views.MapView') {
            console.error("FATAL: Could not find the ESRI MapView instance.");
            return;
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
        console.error("An error occurred during highlight setup or execution:", error);
    }
}

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