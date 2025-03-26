// content.js for the new ArcGIS Experience site

// Inject stylesheet
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .parcel-analyzer-controls {
            margin: 15px 0;
            padding: 12px;
            border-radius: 5px;
            background: #f5f5f5;
            border: 2px solid #d9534f;
            font-family: Arial, sans-serif;
            position: relative;
            z-index: 1000;
        }

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
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 10px 0;
            flex-wrap: wrap;
        }

        .property-name-input {
            padding: 8px 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
            width: 100%;
            margin-top: 5px;
            box-sizing: border-box;
        }

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
        }

        .site-marker {
            color: white;
            background-color: rgba(217, 83, 79, 0.8);
            font-size: 16px;
        }

        .property-marker {
            color: white;
            background-color: rgba(92, 184, 92, 0.8);
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
        this.addCustomControls = this.addCustomControls.bind(this);
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
        
        // Function to check and handle new property selection
        const checkForPropertySelection = () => {
            // Check if the feature info component is visible with various selectors
            const featureInfo = document.querySelector('.feature-info-component');
            const featuresHeading = document.querySelector('.esri-features__heading');
            const featuresContainer = document.querySelector('#features-container');
            
            if (featureInfo && featuresHeading) {
                console.log('Found feature info panel with heading:', featuresHeading.textContent);
                
                // Try multiple container options
                const containerOptions = [
                    featuresContainer,
                    document.querySelector('.esri-features__content-container'),
                    document.querySelector('.esri-features__content-feature'),
                    document.querySelector('.esri-feature')
                ];
                
                // Find the first available container
                const container = containerOptions.find(c => c);
                
                if (container) {
                    // Check if our controls are not already added
                    if (!document.querySelector('.parcel-analyzer-controls')) {
                        console.log('Property selected, adding controls to container:', container);
                        // Extract property information
                        this.extractPropertyInfo();
                        // Add our custom controls
                        this.addCustomControls(container);
                    }
                } else {
                    console.log('Feature info found but no suitable container');
                    // If no container, maybe add a floating control panel as last resort
                    if (!document.querySelector('.parcel-analyzer-controls') && this.currentProperty) {
                        this.addFloatingControlPanel();
                    }
                }
            } else {
                console.log('No feature info panel detected');
            }
        };
        
        // Initial checks with delays
        setTimeout(checkForPropertySelection, 1000);
        setTimeout(checkForPropertySelection, 2000);
        setTimeout(checkForPropertySelection, 3000);
        
        // Create a mutation observer to watch for when a property is selected
        this.featureObserver = new MutationObserver((mutations) => {
            // Debounce the handler to prevent multiple executions
            clearTimeout(this.observerTimeout);
            this.observerTimeout = setTimeout(checkForPropertySelection, 300);
        });

        // Observe the entire document body for changes
        this.featureObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
        
        // Also set up an interval to check periodically
        // This helps catch cases where the mutation observer might miss changes
        this.checkInterval = setInterval(checkForPropertySelection, 2000);
    }
    
    // Add a floating control panel as a last resort
    addFloatingControlPanel() {
        if (!this.currentProperty) return;
        
        console.log('Adding floating control panel');
        
        // Remove any existing controls first
        const existingControls = document.querySelectorAll('.parcel-analyzer-controls');
        existingControls.forEach(control => control.remove());
        
        // Create controls container with distinctive styling
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'parcel-analyzer-controls';
        controlsContainer.style.border = '2px solid #ff0000';
        controlsContainer.style.padding = '12px';
        controlsContainer.style.margin = '15px 0';
        controlsContainer.style.backgroundColor = '#f9f9f9';
        controlsContainer.style.borderRadius = '5px';
        controlsContainer.style.position = 'fixed';
        controlsContainer.style.top = '80px';
        controlsContainer.style.right = '20px';
        controlsContainer.style.zIndex = '10000';
        controlsContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        
        // Create heading for our controls section
        const heading = document.createElement('h3');
        heading.textContent = 'Parcel Analyzer Tools';
        heading.style.margin = '0 0 10px 0';
        heading.style.fontSize = '16px';
        heading.style.color = '#d9534f';
        heading.style.fontWeight = 'bold';
        controlsContainer.appendChild(heading);
        
        // Create different controls based on whether this is the site property
        if (this.siteProperty && this.currentProperty.parcelId === this.siteProperty.parcelId) {
            // This is the site property - add unset button
            const unsetButton = document.createElement('button');
            unsetButton.className = 'parcel-analyzer-button unset-button';
            unsetButton.textContent = 'Unset as SITE';
            unsetButton.addEventListener('click', () => this.unsetSiteProperty());
            controlsContainer.appendChild(unsetButton);
            
            // Also add download button
            const downloadButton = document.createElement('button');
            downloadButton.className = 'parcel-analyzer-button download-button';
            downloadButton.textContent = 'Download Selected Data';
            downloadButton.addEventListener('click', () => this.downloadSelectedData());
            controlsContainer.appendChild(downloadButton);
            
        } else if (!this.siteProperty) {
            // No site property set yet - add set as site button
            const setSiteButton = document.createElement('button');
            setSiteButton.className = 'parcel-analyzer-button site-button';
            setSiteButton.textContent = 'Set as SITE';
            setSiteButton.addEventListener('click', () => this.setSiteProperty());
            controlsContainer.appendChild(setSiteButton);
            
        } else {
            // This is not the site property and a site is already set - add property selection
            const selectionDiv = document.createElement('div');
            selectionDiv.className = 'property-selection';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'selectProperty';
            checkbox.checked = this.isPropertySelected(this.currentProperty.parcelId);
            checkbox.addEventListener('change', (e) => this.togglePropertySelection(e.target.checked));
            
            const label = document.createElement('label');
            label.htmlFor = 'selectProperty';
            label.textContent = 'Include in download';
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'property-name-input';
            nameInput.placeholder = 'Custom property name';
            nameInput.value = this.getPropertyCustomName(this.currentProperty.parcelId) || this.getAutoAssignedName() || '';
            nameInput.addEventListener('input', (e) => this.updatePropertyName(e.target.value));
            
            selectionDiv.appendChild(checkbox);
            selectionDiv.appendChild(label);
            selectionDiv.appendChild(nameInput);
            controlsContainer.appendChild(selectionDiv);
            
            // Add download button for convenience
            const downloadButton = document.createElement('button');
            downloadButton.className = 'parcel-analyzer-button download-button';
            downloadButton.textContent = 'Download Selected Data';
            downloadButton.addEventListener('click', () => this.downloadSelectedData());
            controlsContainer.appendChild(downloadButton);
        }
        
        // Add close button
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
        
        // Add to body
        document.body.appendChild(controlsContainer);
    }

    extractPropertyInfo() {
        try {
            // Get property header which contains parcel ID and address
            const header = document.querySelector('.esri-features__heading');
            if (!header) {
                console.log('Could not find property header');
                return null;
            }

            // Parse the header text to extract parcel ID and address
            const headerText = header.textContent.trim();
            console.log('Found header text:', headerText);
            
            // First try to extract using the colon format
            let parcelId = null;
            let address = null;
            
            if (headerText.includes(':')) {
                const parts = headerText.split(':');
                parcelId = parts[0].trim();
                address = parts.slice(1).join(':').trim();
            } else {
                // If no colon, use the whole text as address
                address = headerText;
            }
            
            // If we couldn't parse the parcel ID from the header, try to find it in the table
            if (!parcelId) {
                console.log('Attempting to find parcel ID in the table');
                const allTableCells = document.querySelectorAll('.esri-feature-content td');
                for (let i = 0; i < allTableCells.length; i++) {
                    const cell = allTableCells[i];
                    if (cell.textContent.includes('Parcel ID')) {
                        // The next cell should contain the parcel ID
                        const nextCell = allTableCells[i + 1];
                        if (nextCell) {
                            parcelId = nextCell.textContent.trim().replace(/\s+/g, ''); // Remove any whitespace
                            console.log('Found parcel ID in table:', parcelId);
                            break;
                        }
                    }
                }
            }
            
            // Get property coordinates from the map (this is simplified)
            const coordinates = this.getPropertyCoordinates();

            // Extract PDF links
            const pdfLinks = this.extractPDFLinks();

            // Create a property object
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
            return null;
        }
    }

    getPropertyCoordinates() {
        // This is a placeholder - in a real implementation, 
        // we would need to extract the property's actual coordinates from the map
        // This might involve interacting with the ArcGIS JavaScript API
        
        // For now, we'll use a position near the center of the current view
        // and add some randomness to spread out multiple markers
        const mapView = document.querySelector('.esri-view');
        if (!mapView) return { x: 0, y: 0 };
        
        const rect = mapView.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Add some randomness to position (±50px)
        const randomOffset = () => Math.floor(Math.random() * 100) - 50;
        
        return {
            x: centerX + randomOffset(),
            y: centerY + randomOffset()
        };
    }

    extractPDFLinks() {
        const links = {};
        
        try {
            // Find all table cells in the property info panel
            const tableCells = document.querySelectorAll('.feature-info-component td');
            
            // Iterate through cells to find ones with instrument links
            for (let i = 0; i < tableCells.length; i++) {
                const cell = tableCells[i];
                const cellText = cell.textContent.trim();
                
                // Check if this is a label cell for an instrument
                if (cellText.includes('Sale Instrument')) {
                    // The next cell should contain the link
                    const nextCell = tableCells[i + 1];
                    if (nextCell) {
                        const link = nextCell.querySelector('a');
                        if (link) {
                            links.saleInstrument = {
                                url: link.href,
                                text: link.textContent.trim()
                            };
                        }
                    }
                }
                
                if (cellText.includes('Parcel Instrument')) {
                    // The next cell should contain the link
                    const nextCell = tableCells[i + 1];
                    if (nextCell) {
                        const link = nextCell.querySelector('a');
                        if (link) {
                            links.parcelInstrument = {
                                url: link.href,
                                text: link.textContent.trim()
                            };
                        }
                    }
                }
            }
            
            return links;
        } catch (error) {
            console.error('Error extracting PDF links:', error);
            return links;
        }
    }

    addCustomControls(featureContainer) {
        if (!this.currentProperty || !featureContainer) {
            console.log('Cannot add controls - missing property or container');
            return;
        }
        
        // Check if the parcel ID exists, if not, see if we can extract it now
        if (!this.currentProperty.parcelId) {
            console.log('Missing parcel ID, attempting to extract from table');
            // Try to find it in the table
            const allTableCells = document.querySelectorAll('.esri-feature-content td');
            for (let i = 0; i < allTableCells.length; i++) {
                const cell = allTableCells[i];
                if (cell.textContent.includes('Parcel ID')) {
                    // The next cell should contain the parcel ID
                    const nextCell = allTableCells[i + 1];
                    if (nextCell) {
                        this.currentProperty.parcelId = nextCell.textContent.trim().replace(/\s+/g, '');
                        console.log('Found parcel ID in table:', this.currentProperty.parcelId);
                        break;
                    }
                }
            }
            
            // If we still can't find a parcel ID, create one from the address
            if (!this.currentProperty.parcelId && this.currentProperty.address) {
                this.currentProperty.parcelId = 'UNKNOWN-' + Date.now();
                console.log('Created temporary parcel ID:', this.currentProperty.parcelId);
            }
        }
        
        if (!this.currentProperty.parcelId) {
            console.log('Cannot add controls - still missing parcel ID');
            return;
        }
        
        console.log('Adding custom controls for parcel:', this.currentProperty.parcelId);
        
        // Remove any existing controls first
        const existingControls = document.querySelectorAll('.parcel-analyzer-controls');
        existingControls.forEach(control => control.remove());
        
        // Create controls container with distinctive styling
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'parcel-analyzer-controls';
        controlsContainer.style.border = '3px solid #ff0000';
        controlsContainer.style.padding = '15px';
        controlsContainer.style.margin = '15px 0';
        controlsContainer.style.backgroundColor = '#fff8f8';
        controlsContainer.style.borderRadius = '5px';
        controlsContainer.style.position = 'relative';
        controlsContainer.style.zIndex = '1000';
        controlsContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
        
        // Create heading for our controls section
        const heading = document.createElement('h3');
        heading.textContent = 'Parcel Analyzer Tools';
        heading.style.margin = '0 0 15px 0';
        heading.style.fontSize = '18px';
        heading.style.color = '#d9534f';
        heading.style.fontWeight = 'bold';
        heading.style.textAlign = 'center';
        controlsContainer.appendChild(heading);
        
        // Show the property info for confirmation
        const propertyInfo = document.createElement('div');
        propertyInfo.innerHTML = `<strong>Selected:</strong> ${this.currentProperty.parcelId}`;
        propertyInfo.style.marginBottom = '15px';
        propertyInfo.style.fontSize = '14px';
        propertyInfo.style.backgroundColor = '#f5f5f5';
        propertyInfo.style.padding = '8px';
        propertyInfo.style.borderRadius = '4px';
        controlsContainer.appendChild(propertyInfo);
        
        // Create different controls based on whether this is the site property
        if (this.siteProperty && this.currentProperty.parcelId === this.siteProperty.parcelId) {
            // This is the site property - add unset button
            const unsetButton = document.createElement('button');
            unsetButton.className = 'parcel-analyzer-button unset-button';
            unsetButton.textContent = 'Unset as SITE';
            unsetButton.style.fontSize = '16px';
            unsetButton.style.padding = '12px 16px';
            unsetButton.addEventListener('click', () => this.unsetSiteProperty());
            controlsContainer.appendChild(unsetButton);
            
            // Also add download button
            const downloadButton = document.createElement('button');
            downloadButton.className = 'parcel-analyzer-button download-button';
            downloadButton.textContent = 'Download Selected Data';
            downloadButton.style.fontSize = '16px';
            downloadButton.style.padding = '12px 16px';
            downloadButton.addEventListener('click', () => this.downloadSelectedData());
            downloadButton.style.marginTop = '15px';
            controlsContainer.appendChild(downloadButton);
            
        } else if (!this.siteProperty) {
            // No site property set yet - add set as site button
            const setSiteButton = document.createElement('button');
            setSiteButton.className = 'parcel-analyzer-button site-button';
            setSiteButton.textContent = 'Set as SITE';
            setSiteButton.style.fontSize = '16px';
            setSiteButton.style.padding = '12px 16px';
            setSiteButton.addEventListener('click', () => this.setSiteProperty());
            controlsContainer.appendChild(setSiteButton);
            
        } else {
            // This is not the site property and a site is already set - add property selection
            const selectionDiv = document.createElement('div');
            selectionDiv.className = 'property-selection';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'selectProperty';
            checkbox.checked = this.isPropertySelected(this.currentProperty.parcelId);
            checkbox.addEventListener('change', (e) => this.togglePropertySelection(e.target.checked));
            checkbox.style.transform = 'scale(1.5)';
            checkbox.style.margin = '0 10px 0 0';
            
            const label = document.createElement('label');
            label.htmlFor = 'selectProperty';
            label.textContent = 'Include in download';
            label.style.fontSize = '14px';
            label.style.fontWeight = 'bold';
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'property-name-input';
            nameInput.placeholder = 'Custom property name';
            nameInput.value = this.getPropertyCustomName(this.currentProperty.parcelId) || this.getAutoAssignedName() || '';
            nameInput.style.marginTop = '10px';
            nameInput.style.width = '100%';
            nameInput.style.padding = '10px';
            nameInput.style.fontSize = '14px';
            nameInput.addEventListener('input', (e) => this.updatePropertyName(e.target.value));
            
            selectionDiv.appendChild(checkbox);
            selectionDiv.appendChild(label);
            selectionDiv.appendChild(document.createElement('br'));
            selectionDiv.appendChild(nameInput);
            controlsContainer.appendChild(selectionDiv);
            
            // Add download button for convenience
            const downloadButton = document.createElement('button');
            downloadButton.className = 'parcel-analyzer-button download-button';
            downloadButton.textContent = 'Download Selected Data';
            downloadButton.style.fontSize = '16px';
            downloadButton.style.padding = '12px 16px';
            downloadButton.style.marginTop = '15px';
            downloadButton.addEventListener('click', () => this.downloadSelectedData());
            controlsContainer.appendChild(downloadButton);
        }
        
        // Try multiple insertion points to find one that works
        try {
            // Find the best place to insert our controls
            const featureContent = document.querySelector('.esri-feature-content');
            const contentContainer = document.querySelector('.esri-features__content-container');
            
            // Log DOM structure for debugging
            console.log('Feature container structure:', featureContainer);
            
            // Try to find a good insertion point
            if (featureContent) {
                // Insert right after the feature content
                featureContent.parentNode.insertBefore(controlsContainer, featureContent.nextSibling);
                console.log('Added controls after feature content');
            } else if (contentContainer) {
                // Insert at beginning of content container
                contentContainer.insertBefore(controlsContainer, contentContainer.firstChild);
                console.log('Added controls at beginning of content container');
            } else {
                // Insert at beginning of feature container
                featureContainer.insertBefore(controlsContainer, featureContainer.firstChild);
                console.log('Added controls at beginning of feature container');
            }
        } catch (error) {
            console.error('Failed to insert controls:', error);
            
            // Last resort - add to body as a floating panel
            this.addFloatingControlPanel();
        }
    }

    setSiteProperty() {
        if (!this.currentProperty) return;
        
        this.siteProperty = {...this.currentProperty};
        this.selectedProperties.clear();
        this.refreshMarkers();
        
        // Refresh controls
        const featureContainer = document.querySelector('#features-container');
        if (featureContainer) {
            const controls = featureContainer.querySelector('.parcel-analyzer-controls');
            if (controls) {
                controls.remove();
                this.addCustomControls(featureContainer);
            }
        }
        
        console.log('Set site property:', this.siteProperty);
    }

    unsetSiteProperty() {
        this.siteProperty = null;
        this.selectedProperties.clear();
        this.refreshMarkers();
        
        // Refresh controls
        const featureContainer = document.querySelector('#features-container');
        if (featureContainer) {
            const controls = featureContainer.querySelector('.parcel-analyzer-controls');
            if (controls) {
                controls.remove();
                this.addCustomControls(featureContainer);
            }
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
        if (!this.currentProperty) return;
        
        if (checked) {
            const autoName = this.getAutoAssignedName();
            this.selectedProperties.set(this.currentProperty.parcelId, {
                ...this.currentProperty,
                customName: autoName
            });
        } else {
            this.selectedProperties.delete(this.currentProperty.parcelId);
        }
        
        this.refreshMarkers();
    }

    updatePropertyName(newName) {
        if (!this.currentProperty) return;
        
        if (this.selectedProperties.has(this.currentProperty.parcelId)) {
            const property = this.selectedProperties.get(this.currentProperty.parcelId);
            property.customName = newName;
            this.selectedProperties.set(this.currentProperty.parcelId, property);
            this.refreshMarkers();
        }
    }

    getAutoAssignedName() {
        // This is a placeholder - in a real implementation, 
        // we would calculate cardinal directions based on actual coordinates
        return 'Adjacent';
    }

    refreshMarkers() {
        // Remove all existing markers
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
        
        // Create markers container if it doesn't exist
        let markersContainer = document.querySelector('#property-markers');
        if (!markersContainer) {
            markersContainer = document.createElement('div');
            markersContainer.id = 'property-markers';
            document.body.appendChild(markersContainer);
        } else {
            markersContainer.innerHTML = '';
        }
        
        // Find the map view to position markers
        const mapView = document.querySelector('.esri-view');
        if (!mapView) {
            console.log('Cannot create markers - map view not found');
            return;
        }
        
        // Helper function to create a marker
        const createMarker = (label, isMain, coordinates) => {
            const marker = document.createElement('div');
            marker.className = isMain ? 'site-marker' : 'property-marker';
            marker.textContent = label;
            marker.style.position = 'absolute';
            marker.style.padding = '5px 10px';
            marker.style.borderRadius = '4px';
            marker.style.backgroundColor = isMain ? 'rgba(217, 83, 79, 0.9)' : 'rgba(92, 184, 92, 0.9)';
            marker.style.color = 'white';
            marker.style.fontWeight = 'bold';
            marker.style.fontSize = isMain ? '16px' : '14px';
            marker.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            marker.style.zIndex = '9999';
            marker.style.transform = 'translate(-50%, -50%)';
            marker.style.left = `${coordinates.x}px`;
            marker.style.top = `${coordinates.y}px`;
            marker.style.pointerEvents = 'none'; // Make sure it doesn't interfere with map clicks
            
            // Add a pulse effect
            marker.style.animation = 'pulse 2s infinite';
            
            return marker;
        };
        
        // Add site marker if set
        if (this.siteProperty) {
            // Position in center of map view for visibility
            const rect = mapView.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 3; // Position in upper third
            
            const siteCoordinates = { 
                x: centerX, 
                y: centerY 
            };
            
            const siteMarker = createMarker('SITE', true, siteCoordinates);
            markersContainer.appendChild(siteMarker);
            this.markers.push(siteMarker);
            
            // Add markers for selected properties in a grid around the site
            const propertyCount = this.selectedProperties.size;
            let index = 0;
            
            this.selectedProperties.forEach((property) => {
                // Position in a grid or circle around the site marker
                const angle = (index / propertyCount) * 2 * Math.PI;
                const radius = 150; // Distance from site marker
                
                const propertyX = centerX + radius * Math.cos(angle);
                const propertyY = centerY + radius * Math.sin(angle);
                
                const propertyCoordinates = {
                    x: propertyX,
                    y: propertyY
                };
                
                const propertyMarker = createMarker(property.customName || 'Adjacent', false, propertyCoordinates);
                markersContainer.appendChild(propertyMarker);
                this.markers.push(propertyMarker);
                
                index++;
            });
            
            // Add CSS animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { transform: translate(-50%, -50%) scale(1); }
                    50% { transform: translate(-50%, -50%) scale(1.1); }
                    100% { transform: translate(-50%, -50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    async downloadSelectedData() {
        if (!this.siteProperty) {
            console.error('No site property selected');
            return;
        }
        
        console.log('Starting downloads...');
        
        // Download site PDFs
        await this.downloadPropertyPDFs(this.siteProperty, 'SITE');
        
        // Download selected properties PDFs
        for (const property of this.selectedProperties.values()) {
            await this.downloadPropertyPDFs(property, property.customName || 'Adjacent');
        }
        
        console.log('Downloads complete');
    }

    async downloadPropertyPDFs(property, label) {
        if (!property || !property.pdfLinks) return;
        
        // Download Sale Instrument PDF if available
        if (property.pdfLinks.saleInstrument) {
            const fileName = `${property.parcelId} - ${label} - Sale.pdf`;
            console.log(`Downloading ${fileName} from ${property.pdfLinks.saleInstrument.url}`);
            
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'download',
                    url: property.pdfLinks.saleInstrument.url,
                    filename: fileName
                });
                
                if (!response?.success) {
                    console.error(`Failed to download ${fileName}:`, response?.error);
                }
            } catch (error) {
                console.error(`Error initiating download for ${fileName}:`, error);
            }
        }
        
        // Download Parcel Instrument PDF if available
        if (property.pdfLinks.parcelInstrument) {
            const fileName = `${property.parcelId} - ${label} - Parcel.pdf`;
            console.log(`Downloading ${fileName} from ${property.pdfLinks.parcelInstrument.url}`);
            
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'download',
                    url: property.pdfLinks.parcelInstrument.url,
                    filename: fileName
                });
                
                if (!response?.success) {
                    console.error(`Failed to download ${fileName}:`, response?.error);
                }
            } catch (error) {
                console.error(`Error initiating download for ${fileName}:`, error);
            }
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ParcelAnalyzer.initialize());
} else {
    ParcelAnalyzer.initialize();
}