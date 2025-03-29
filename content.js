// content.js for the new ArcGIS Experience site
function injectScript (src) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(src);
    s.onload = () => s.remove();
    (document.head || document.documentElement).append(s);
}

injectScript('highlight_parcel.js')

// Inject stylesheet
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Target the specific General Info panel content area for flex layout */
        div[data-layoutid="layout_81"] > div[data-layoutitemid="0"] .panel-content {
            display: flex;
            flex-direction: column;
        }

        .parcel-analyzer-controls {
            /* Ensure it appears above the feature info content using flex order */
            order: -1;
            margin-bottom: 15px; /* Add space below the controls */
            margin-top: 0; /* Remove top margin if added */
            padding: 12px;
            border-radius: 5px;
            background: #fff8f8; /* Keep the light red background */
            border: 3px solid #ff0000; /* Keep the red border */
            font-family: Arial, sans-serif;
            position: relative; /* Keep relative for z-index within its container */
            z-index: 10; /* Ensure it's above siblings within panel-content */
            box-shadow: 0 0 10px rgba(0,0,0,0.2);
        }

        /* Floating panel specific styles (if ever needed again) */
        .parcel-analyzer-controls.floating {
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000; /* High z-index for floating */
            margin: 0; /* Reset margin */
        }


        /* --- Other styles remain the same --- */

        .parcel-analyzer-button {
            background-color: #0079c1;
            color: white;
            border: none;
            padding: 10px 16px;
            margin: 5px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: background-color 0.2s;
            display: block;
            width: calc(100% - 10px);
            text-align: center;
        }

        .parcel-analyzer-button:hover {
            background-color: #005e95;
            transform: translateY(-1px);
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }

        .parcel-analyzer-button.site-button {
            background-color: #d9534f;
        }

        .parcel-analyzer-button.site-button:hover {
            background-color: #c9302c;
        }

        .parcel-analyzer-button.unset-button {
            background-color: #f0ad4e;
        }

        .parcel-analyzer-button.unset-button:hover {
            background-color: #ec971f;
        }

        .parcel-analyzer-button.download-button {
            background-color: #5cb85c;
            margin-top: 10px;
        }

        .parcel-analyzer-button.download-button:hover {
            background-color: #449d44;
        }

        .property-selection {
            /* Use flexbox for checkbox and label alignment */
            display: flex;
            align-items: center;
            margin: 15px 0 10px 0; /* Adjust margins */
            flex-wrap: wrap; /* Allow input to wrap below */
        }

        .property-selection input[type="checkbox"] {
            transform: scale(1.5);
            margin: 0 10px 0 5px; /* Adjust margins */
            flex-shrink: 0; /* Prevent checkbox from shrinking */
        }
        .property-selection label {
            font-size: 14px;
            font-weight: bold;
            cursor: pointer; /* Make label clickable */
            flex-grow: 1; /* Allow label to take space */
            margin-bottom: 0; /* Remove bottom margin if any */
        }

        .property-name-input {
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
            width: 100%; /* Full width */
            margin-top: 10px; /* Space above input */
            box-sizing: border-box;
        }

        /* --- Marker styles remain the same --- */
        .site-marker, .property-marker {
            position: absolute;
            padding: 5px 10px;
            border-radius: 3px;
            z-index: 1000;
            pointer-events: none;
            font-weight: bold;
            text-shadow: 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white;
            box-shadow: 0 0 5px rgba(0,0,0,0.2);
            transform: translate(-50%, -50%);
            white-space: nowrap;
        }

        .site-marker {
            color: white;
            background-color: rgba(217, 83, 79, 0.9); /* Slightly darker */
            font-size: 16px;
        }

        .property-marker {
            color: white;
            background-color: rgba(92, 184, 92, 0.9); /* Slightly darker */
            font-size: 14px;
        }
    `;
    document.head.appendChild(style);
}

class ParcelAnalyzer {
    constructor() {
        this.siteProperty = null;
        this.currentProperty = null;
        this.selectedProperties = new Map(); // Map to store selected properties
        this.markers = [];
        this.featureObserver = null;
        this.observerTimeout = null;
        this.checkInterval = null;
        
        // Bind methods to ensure 'this' context is preserved
        this.extractPropertyInfo = this.extractPropertyInfo.bind(this);
        this.addOrUpdateCustomControls = this.addOrUpdateCustomControls.bind(this);
        this.setSiteProperty = this.setSiteProperty.bind(this);
        this.unsetSiteProperty = this.unsetSiteProperty.bind(this);
        this.togglePropertySelection = this.togglePropertySelection.bind(this);
        this.updatePropertyName = this.updatePropertyName.bind(this);
        this.downloadSelectedData = this.downloadSelectedData.bind(this);
        
        // Setup observer and other initialization
        this.setupFeatureObserver();
        console.log('ParcelAnalyzer instance created for ArcGIS Experience');
    }

    static initialize() {
        console.log('Starting ParcelAnalyzer initialization...');
        injectStyles();
        const analyzer = new ParcelAnalyzer();
        
        // Add the instance to window for debugging
        window.parcelAnalyzer = analyzer;
        
        console.log('ParcelAnalyzer initialized and attached to window.parcelAnalyzer');
        return analyzer;
    }

    setupFeatureObserver() {
        console.log('Setting up feature observer');
        
        const checkForPropertySelection = () => {
            // --- Target the General Info panel's content area using aria-label ---
            // Find the header with the specific aria-label
            const generalInfoHeader = document.querySelector('.panel-header[aria-label="General Info"]');
            // Navigate up to the common parent (.panel) and then down to the content area (.panel-content)
            const generalInfoPanel = generalInfoHeader?.closest('.panel');
            const generalInfoContent = generalInfoPanel?.querySelector('.panel-content');

            if (generalInfoContent) {
                // --- Check if the Feature Info widget's content (heading) is loaded *within* the General Info panel ---
                const featureInfoHeading = generalInfoContent.querySelector('.widget-featureInfo .esri-features__heading');

                if (featureInfoHeading) {
                    // Successfully found the target panel and the feature info is displayed
                    console.log('General Info panel with feature info found:', featureInfoHeading.textContent);

                    // Extract property info using the feature info widget as context
                    const featureInfoWidgetElement = generalInfoContent.querySelector('.widget-featureInfo');
                    if (featureInfoWidgetElement) {
                        this.extractPropertyInfo(featureInfoWidgetElement); // Pass specific context
                        // Send a message to the page context to highlight the parcel
                        window.postMessage({
                            type: 'HIGHLIGHT_PARCEL',
                            parcelId: this.currentProperty.parcelId
                        }, '*');
                    } else {
                        console.warn("Found heading but couldn't find .widget-featureInfo container for extraction context. Extracting globally.");
                        this.extractPropertyInfo(); // Fallback to global context
                    }

                    // Add or update controls *within* the General Info panel's content area
                    this.addOrUpdateCustomControls(generalInfoContent);

                } else {
                    // Panel content is there, but feature heading isn't, meaning no feature is selected or it cleared
                    // console.log('General Info content panel found, but no feature heading detected.');
                    // Remove existing controls from this specific panel if no feature is displayed
                    const existingControls = generalInfoContent.querySelector('.parcel-analyzer-controls');
                    if (existingControls) {
                        console.log('Removing stale controls from General Info panel.');
                        existingControls.remove();
                        this.currentProperty = null; // Clear current property state
                    }
                }

            } else {
                // The primary target panel itself wasn't found
                // console.log('General Info panel content area not found.');
                // Clean up any floating controls if they exist from previous incorrect insertions
                document.querySelector('.parcel-analyzer-controls.floating')?.remove();
            }

            // --- Secondary check for floating popup (Keep this minimal) ---
            const floatingPopup = document.querySelector('.esri-popup--is-docked .esri-features__heading');
            if (floatingPopup && !generalInfoContent) { // Only log if general info wasn't found
                console.log('Floating popup detected, but target is General Info panel. Ignoring.');
            }
        };

        // Initial checks with delays
        setTimeout(checkForPropertySelection, 1500); // Increased delay slightly
        setTimeout(checkForPropertySelection, 3000);


        // Create a mutation observer to watch for changes
        this.featureObserver = new MutationObserver((mutations) => {
            // Basic check if relevant nodes were added/removed or text changed
            let relevantChange = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                     // Check if added/removed nodes might contain our target elements
                     const checkNodes = (nodes) => {
                         for(const node of nodes) {
                             if (node.nodeType === Node.ELEMENT_NODE) {
                                 if (node.matches?.('.panel-header[aria-label="General Info"], .widget-featureInfo, .esri-features__heading, .parcel-analyzer-controls')) {
                                     return true;
                                 }
                                 // Check children recursively (might be too slow if not careful)
                                 // if (node.querySelector?.('.panel-header[aria-label="General Info"], .widget-featureInfo, .esri-features__heading')) {
                                 //     return true;
                                 // }
                             }
                         }
                         return false;
                     }
                     if(checkNodes(mutation.addedNodes) || checkNodes(mutation.removedNodes)) {
                         relevantChange = true;
                         break;
                     }

                } else if (mutation.type === 'characterData' && mutation.target.parentElement?.closest('.esri-features__heading')) {
                     relevantChange = true; // Heading text changed
                     break;
                } else if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target.matches?.('.layout-item, .panel, .jimu-widget')) {
                     // Class changes might indicate visibility toggle or loading state
                     relevantChange = true;
                     break;
                }
            }

            if (relevantChange) {
                // Debounce the handler
                clearTimeout(this.observerTimeout);
                this.observerTimeout = setTimeout(checkForPropertySelection, 350); // Slightly longer debounce
            }
        });


        // Observe the entire document body - necessary for dynamically loaded content
        this.featureObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style'], // Observe common dynamic attributes
            characterData: true
        });

        // Fallback interval check (less frequent)
        this.checkInterval = setInterval(checkForPropertySelection, 2500);
    }

    addFloatingControlPanel() {
        // This function remains as a fallback but is unlikely to be called with the current logic.
        if (!this.currentProperty) return;
        console.log('Adding floating control panel (LAST RESORT - NOT PREFERRED)');
        const existingControls = document.querySelectorAll('.parcel-analyzer-controls');
        existingControls.forEach(control => control.remove());
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'parcel-analyzer-controls floating'; // Add 'floating' class
        this.populateControls(controlsContainer);
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '5px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.addEventListener('click', () => controlsContainer.remove());
        controlsContainer.appendChild(closeButton);
        document.body.appendChild(controlsContainer);
    }

    extractPropertyInfo(contextElement = document) {
        try {
            const header = contextElement.querySelector('.esri-features__heading');
            if (!header) {
                console.log('Could not find property header within context:', contextElement.className);
                this.currentProperty = null;
                return null;
            }

            const headerText = header.textContent.trim();
            console.log('Found header text:', headerText);

            let parcelId = null;
            let address = null;

            if (headerText.includes(':')) {
                const parts = headerText.split(':');
                parcelId = parts[0].trim();
                address = parts.slice(1).join(':').trim();
            } else {
                address = headerText;
            }

            // Use the context to find the specific table related to this feature info
            const contentTable = contextElement.querySelector('.esri-feature-content table');

            if (!parcelId && contentTable) {
                // console.log('Attempting to find parcel ID in the specific table');
                const allTableCells = contentTable.querySelectorAll('td');
                for (let i = 0; i < allTableCells.length; i++) {
                    const cell = allTableCells[i];
                    if (cell.textContent.trim() === 'Parcel ID') {
                        const nextCell = allTableCells[i + 1];
                        if (nextCell) {
                            parcelId = nextCell.textContent.trim().replace(/\s+/g, '');
                            console.log('Found parcel ID in table:', parcelId);
                            break;
                        }
                    }
                }
            }

             if (!parcelId) {
                 parcelId = `UNKNOWN_${address ? address.replace(/\s+/g, '_').substring(0, 20) : Date.now()}`; // Limit length
                 console.warn('Could not find Parcel ID, generated temporary ID:', parcelId);
             }

            const coordinates = this.getPropertyCoordinates();
            const pdfLinks = this.extractPDFLinks(contentTable); // Pass table context

            // Avoid storing the DOM element directly if possible, just the data
            this.currentProperty = {
                parcelId,
                address,
                coordinates,
                pdfLinks
            };

            console.log('Extracted property info:', this.currentProperty);
            return this.currentProperty;
        } catch (error) {
            console.error('Error extracting property info:', error);
            this.currentProperty = null;
            return null;
        }
    }

    getPropertyCoordinates() {
        // Placeholder remains the same
        const mapView = document.querySelector('.esri-view');
        if (!mapView) return { x: 0, y: 0 };
        const rect = mapView.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const randomOffset = () => Math.floor(Math.random() * 100) - 50;
        return { x: centerX + randomOffset(), y: centerY + randomOffset() };
    }

    extractPDFLinks(tableElement) {
        // Logic remains the same, relying on the passed tableElement
        const links = {};
        if (!tableElement) {
             // console.warn('No table element provided for PDF link extraction.');
             return links;
        }
        try {
            const tableCells = tableElement.querySelectorAll('td');
            for (let i = 0; i < tableCells.length; i++) {
                const cell = tableCells[i];
                const cellText = cell.textContent.trim();
                if (cellText === 'Sale Instrument') {
                    const nextCell = tableCells[i + 1]?.querySelector('a');
                    if (nextCell) {
                        links.saleInstrument = { url: nextCell.href, text: nextCell.textContent.trim() };
                    }
                }
                if (cellText === 'Parcel Instrument') {
                     const nextCell = tableCells[i + 1]?.querySelector('a');
                    if (nextCell) {
                        links.parcelInstrument = { url: nextCell.href, text: nextCell.textContent.trim() };
                    }
                }
            }
            // console.log('Extracted PDF links:', links);
            return links;
        } catch (error) {
            console.error('Error extracting PDF links:', error);
            return links;
        }
    }

    populateControls(controlsContainer) {
         if (!this.currentProperty || !this.currentProperty.parcelId) {
             console.warn('Cannot populate controls - current property or parcel ID is missing.');
             controlsContainer.innerHTML = '<p style="color: red; text-align: center;">Error: Property data not fully loaded.</p>';
             return;
        }

         controlsContainer.innerHTML = ''; // Clear existing

         const heading = document.createElement('h3');
         heading.textContent = 'Parcel Analyzer Tools';
         heading.style.margin = '0 0 15px 0';
         heading.style.fontSize = '18px';
         heading.style.color = '#d9534f';
         heading.style.fontWeight = 'bold';
         heading.style.textAlign = 'center';
         controlsContainer.appendChild(heading);

         const propertyInfo = document.createElement('div');
         propertyInfo.innerHTML = `<strong>Selected:</strong> ${this.currentProperty.parcelId}`;
         propertyInfo.style.marginBottom = '15px';
         propertyInfo.style.fontSize = '14px';
         propertyInfo.style.backgroundColor = '#f0f0f0';
         propertyInfo.style.padding = '8px';
         propertyInfo.style.borderRadius = '4px';
         propertyInfo.style.border = '1px solid #ddd';
         controlsContainer.appendChild(propertyInfo);

         // --- Logic for buttons based on siteProperty ---
         if (this.siteProperty && this.currentProperty.parcelId === this.siteProperty.parcelId) {
             const unsetButton = document.createElement('button');
             unsetButton.className = 'parcel-analyzer-button unset-button';
             unsetButton.textContent = 'Unset as SITE';
             unsetButton.style.fontSize = '16px';
             unsetButton.style.padding = '12px 16px';
             unsetButton.addEventListener('click', () => this.unsetSiteProperty());
             controlsContainer.appendChild(unsetButton);

             const downloadButton = document.createElement('button');
             downloadButton.className = 'parcel-analyzer-button download-button';
             downloadButton.textContent = 'Download Selected Data';
             downloadButton.style.fontSize = '16px';
             downloadButton.style.padding = '12px 16px';
             downloadButton.addEventListener('click', () => this.downloadSelectedData());
             downloadButton.style.marginTop = '15px';
             controlsContainer.appendChild(downloadButton);

         } else if (!this.siteProperty) {
             const setSiteButton = document.createElement('button');
             setSiteButton.className = 'parcel-analyzer-button site-button';
             setSiteButton.textContent = 'Set as SITE';
             setSiteButton.style.fontSize = '16px';
             setSiteButton.style.padding = '12px 16px';
             setSiteButton.addEventListener('click', () => this.setSiteProperty());
             controlsContainer.appendChild(setSiteButton);

         } else { // Adjacent property
             const selectionDiv = document.createElement('div');
             selectionDiv.className = 'property-selection'; // Use class for styling

             const checkbox = document.createElement('input');
             checkbox.type = 'checkbox';
             checkbox.id = `selectProperty-${this.currentProperty.parcelId}`; // Unique ID
             checkbox.checked = this.isPropertySelected(this.currentProperty.parcelId);
             checkbox.addEventListener('change', (e) => this.togglePropertySelection(e.target.checked));
             // Styles applied via CSS

             const label = document.createElement('label');
             label.htmlFor = checkbox.id;
             label.textContent = 'Include in download';
              // Styles applied via CSS

             const nameInput = document.createElement('input');
             nameInput.type = 'text';
             nameInput.className = 'property-name-input';
             nameInput.placeholder = 'Custom property name (e.g., North)';
             nameInput.value = this.getPropertyCustomName(this.currentProperty.parcelId) || this.getAutoAssignedName() || '';
             nameInput.addEventListener('input', (e) => this.updatePropertyName(e.target.value));
             // Styles applied via CSS

             selectionDiv.appendChild(checkbox);
             selectionDiv.appendChild(label);
             // Removed <br>, rely on flex-wrap and input margin-top
             selectionDiv.appendChild(nameInput); // Input wraps below checkbox/label
             controlsContainer.appendChild(selectionDiv);

             const downloadButton = document.createElement('button');
             downloadButton.className = 'parcel-analyzer-button download-button';
             downloadButton.textContent = 'Download Selected Data';
             downloadButton.style.fontSize = '16px';
             downloadButton.style.padding = '12px 16px';
             // downloadButton.style.marginTop = '15px'; // Already has margin via class
             controlsContainer.appendChild(downloadButton);
         }
    }


    addOrUpdateCustomControls(targetContainer) {
        if (!this.currentProperty || !targetContainer) {
            // console.log('Cannot add/update controls - missing property or target container');
            if (targetContainer) {
                 targetContainer.querySelector('.parcel-analyzer-controls')?.remove();
            }
            return;
        }
        if (!this.currentProperty.parcelId) {
            console.log('Cannot add/update controls - missing parcel ID');
            return;
        }

        // console.log('Adding/Updating custom controls for parcel:', this.currentProperty.parcelId, 'in container:', targetContainer);

        let controlsContainer = targetContainer.querySelector('.parcel-analyzer-controls');

        if (!controlsContainer) {
            // console.log('Creating new controls container.');
            controlsContainer = document.createElement('div');
            controlsContainer.className = 'parcel-analyzer-controls'; // Styles applied via CSS

            // Insert the new container. insertBefore(new, firstChild) effectively prepends it.
            // The `order: -1` style should visually place it first.
            targetContainer.insertBefore(controlsContainer, targetContainer.firstChild);
        }

        // Populate/Repopulate the container with the correct controls
        this.populateControls(controlsContainer);
    }

    setSiteProperty() {
        if (!this.currentProperty) return;
        this.siteProperty = {...this.currentProperty};
        this.selectedProperties.clear();
        this.refreshMarkers();

        // Find the General Info content panel and update its controls
        const generalInfoContent = document.querySelector('.panel-header[aria-label="General Info"]')?.closest('.panel')?.querySelector('.panel-content');
        if (generalInfoContent) {
            this.addOrUpdateCustomControls(generalInfoContent);
        } else {
            console.warn('Could not find General Info panel to refresh controls after setting site.');
        }
        console.log('Set site property:', this.siteProperty);
    }

    unsetSiteProperty() {
        this.siteProperty = null;
        this.selectedProperties.clear();
        this.refreshMarkers();

        // Find the General Info content panel and update its controls
        const generalInfoContent = document.querySelector('.panel-header[aria-label="General Info"]')?.closest('.panel')?.querySelector('.panel-content');
         if (generalInfoContent) {
             // Refresh controls based on the currently displayed property (if any)
             this.addOrUpdateCustomControls(generalInfoContent);
         } else {
             console.warn('Could not find General Info panel to refresh controls after unsetting site.');
         }
        console.log('Unset site property');
    }

    isPropertySelected(parcelId) {
        return this.selectedProperties.has(parcelId);
    }

    getPropertyCustomName(parcelId) {
        const property = this.selectedProperties.get(parcelId);
        return property ? property.customName : null;
    }

    togglePropertySelection(checked) {
        if (!this.currentProperty || !this.currentProperty.parcelId) return;
        const parcelId = this.currentProperty.parcelId;

        if (checked) {
             // Find the input specific to the current controls context
             const controlsContainer = document.querySelector('.parcel-analyzer-controls:not(.floating)'); // Prefer non-floating
             const nameInput = controlsContainer?.querySelector(`.property-name-input`);
             const customName = nameInput ? nameInput.value.trim() : this.getAutoAssignedName();

            this.selectedProperties.set(parcelId, {
                ...this.currentProperty,
                customName: customName || this.getAutoAssignedName()
            });
            console.log(`Selected property ${parcelId} with name "${customName || this.getAutoAssignedName()}"`);
        } else {
            this.selectedProperties.delete(parcelId);
            console.log(`Deselected property ${parcelId}`);
        }
        this.refreshMarkers();
    }

    updatePropertyName(newName) {
        if (!this.currentProperty || !this.currentProperty.parcelId) return;
        const parcelId = this.currentProperty.parcelId;

        if (this.selectedProperties.has(parcelId)) {
            const property = this.selectedProperties.get(parcelId);
            property.customName = newName.trim(); // Trim whitespace
            this.selectedProperties.set(parcelId, property);
            this.refreshMarkers();
            console.log(`Updated name for property ${parcelId} to "${property.customName}"`);
        } else {
             // console.log(`Property ${parcelId} not selected, name update ignored.`);
        }
    }

    getAutoAssignedName() {
        const count = this.selectedProperties.size;
        return `Adjacent ${count + 1}`;
    }

    refreshMarkers() {
        // Logic remains the same - uses absolute positioning based on map view bounds
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
        let markersContainer = document.querySelector('#property-markers');
        if (!markersContainer) {
            markersContainer = document.createElement('div');
            markersContainer.id = 'property-markers';
            document.body.appendChild(markersContainer);
        } else {
            markersContainer.innerHTML = '';
        }
        const mapView = document.querySelector('.esri-view');
        if (!mapView) return;

        const createMarker = (label, isMain, coordinates) => {
             const marker = document.createElement('div');
             marker.className = isMain ? 'site-marker' : 'property-marker';
             marker.textContent = label;
             marker.style.left = `${coordinates.x}px`;
             marker.style.top = `${coordinates.y}px`;
             // Other styles applied via CSS
             return marker;
        };

        if (this.siteProperty) {
            const rect = mapView.getBoundingClientRect();
            const siteX = rect.left + rect.width / 2;
            const siteY = rect.top + rect.height / 3;
            const siteCoordinates = { x: siteX, y: siteY };
            const siteMarker = createMarker('SITE', true, siteCoordinates);
            markersContainer.appendChild(siteMarker);
            this.markers.push(siteMarker);

            const propertyCount = this.selectedProperties.size;
            const radius = 120;
            const startAngle = -Math.PI / 2;

            Array.from(this.selectedProperties.values()).forEach((property, index) => {
                const angle = startAngle + (index / propertyCount) * 2 * Math.PI;
                const propertyX = siteX + radius * Math.cos(angle);
                const propertyY = siteY + radius * Math.sin(angle);
                const propertyCoordinates = { x: propertyX, y: propertyY };
                const label = property.customName || 'Adjacent';
                const propertyMarker = createMarker(label, false, propertyCoordinates);
                markersContainer.appendChild(propertyMarker);
                this.markers.push(propertyMarker);
            });
        }
    }

    async downloadSelectedData() {
        // Logic remains the same - uses background script for downloads
        if (!this.siteProperty) {
             alert('Please set a SITE property first.');
             console.error('No site property selected for download.');
             return;
        }
        console.log('Starting downloads...');
        let downloadCount = 0;
        downloadCount += await this.downloadPropertyPDFs(this.siteProperty, 'SITE');
        for (const property of this.selectedProperties.values()) {
             downloadCount += await this.downloadPropertyPDFs(property, property.customName || 'Adjacent');
        }
        if (downloadCount > 0) {
             console.log(`Attempted to initiate ${downloadCount} downloads.`);
        } else {
             console.log('No PDF links found for selected properties.');
             alert('No PDF documents found for the selected properties.');
        }
    }

    async downloadPropertyPDFs(property, label) {
        // Logic remains the same - uses background script
         if (!property || !property.pdfLinks) return 0;
         let initiatedDownloads = 0;
         const safeLabel = label.replace(/[^a-zA-Z0-9\s-]/g, '_');

         const downloadLink = async (linkInfo, type) => {
             if (linkInfo && linkInfo.url) {
                 const fileName = `${property.parcelId} - ${safeLabel} - ${type}.pdf`;
                 console.log(`Requesting download: ${fileName} from ${linkInfo.url}`);
                 try {
                     const response = await chrome.runtime.sendMessage({
                         type: 'download', url: linkInfo.url, filename: fileName
                     });
                     if (response?.success) initiatedDownloads++;
                     else console.error(`Failed download for ${fileName}:`, response?.error);
                 } catch (error) {
                     console.error(`Error sending download message for ${fileName}:`, error);
                 }
                 await new Promise(resolve => setTimeout(resolve, 200)); // Delay
             } else {
                  console.log(`No ${type} PDF link found for ${property.parcelId} (${label})`);
             }
         };

         await downloadLink(property.pdfLinks.saleInstrument, 'Sale');
         await downloadLink(property.pdfLinks.parcelInstrument, 'Parcel');

         return initiatedDownloads;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ParcelAnalyzer.initialize());
} else {
    ParcelAnalyzer.initialize();
}