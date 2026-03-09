// ==UserScript==
// @name         Maaltijdzorg - UI Fix & Refined Styling
// @namespace    http://tampermonkey.net/
// @version      4.13
// @description  Fixed ZZ attachment, bold Menu line, and grey "Andere info" section.
// @author       You
// @match        https://mijn.maaltijdzorgplatform.be/Route/Rijden*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Nicolas-Veys/Maaltijdzorg/main/Maaltijdzorg.user.js
// @downloadURL  https://raw.githubusercontent.com/Nicolas-Veys/Maaltijdzorg/main/Maaltijdzorg.user.js
// ==/UserScript==

(function () {
    'use strict';

    const THEME_COLOR = '#34a853';
    const PICKUP_COLOR = '#f1c40f';
    const DROPOFF_COLOR = '#17a2b8';

    function getTodayString() { return new Date().toLocaleDateString('nl-BE'); }
    function loadPickupData() {
        let data = JSON.parse(localStorage.getItem('tm_pickup_data') || 'null');
        if (!data || data.date !== getTodayString()) return { date: getTodayString(), normal: [], extra: [] };
        return data;
    }
    function savePickupData(data) { localStorage.setItem('tm_pickup_data', JSON.stringify(data)); }

    function loadDropoffData() {
        let data = JSON.parse(localStorage.getItem('tm_dropoff_data') || 'null');
        if (!data || data.date !== getTodayString()) return { date: getTodayString(), normal: [], samen: [], extra: [] };
        return data;
    }
    function saveDropoffData(data) { localStorage.setItem('tm_dropoff_data', JSON.stringify(data)); }

    function loadComponentsData() {
        let data = JSON.parse(localStorage.getItem('tm_components_data') || 'null');
        if (!data || data.date !== getTodayString()) return { date: getTodayString(), components: [] };
        return data;
    }
    function saveComponentsData(data) { localStorage.setItem('tm_components_data', JSON.stringify(data)); }

    // Original format appears to be: [Last Name] [First Name] [Middle Name(s)] or [Last Name prefix] [Last Name] [First Name] [Middle Name(s)]
    // We want: [First Name] [Middle Name(s)] [Last Name prefix] [Last Name]
    function swapDisplayName(fullName) {
        if (!fullName || typeof fullName !== 'string') return fullName;
        const match = fullName.match(/^(\d+\.\s*)?(.*)$/);
        const prefix = (match && match[1]) ? match[1] : '';
        const name = (match && match[2]) ? match[2].trim() : fullName.trim();
        const words = name.split(/\s+/).filter(Boolean);
        if (words.length < 2) return fullName;

        // Extract the full last name (including prefixes like Van, De, Van den)
        let lastNameParts = [];
        let i = 0;

        if (i + 2 < words.length && words[i].toLowerCase() === 'van' && ['den', 'de', 'der'].includes(words[i + 1].toLowerCase())) {
            lastNameParts.push(words[i], words[i + 1], words[i + 2]);
            i += 3;
        } else if (i + 1 < words.length && ['de', 'van', 'le', 'la', 'den', 'het'].includes(words[i].toLowerCase())) {
            lastNameParts.push(words[i], words[i + 1]);
            i += 2;
        } else {
            lastNameParts.push(words[i]);
            i += 1;
        }

        const lastName = lastNameParts.join(' ');
        const firstAndMiddleNames = words.slice(i).join(' ');

        return prefix + firstAndMiddleNames + (firstAndMiddleNames ? ' ' : '') + lastName;
    }

    function applyPickupsToUI() {
        const data = loadPickupData();
        document.querySelectorAll('.tm-pickup-tag').forEach(el => el.remove());
        document.querySelectorAll('.tm-extra-pickup-row').forEach(el => el.remove());

        document.querySelectorAll('.tm-client-header-container').forEach(h => {
            if (data.normal.includes(h.dataset.clientName)) {
                h.innerHTML += '<div class="tm-pickup-tag">menu ophalen</div>';
            }
        });

        data.extra.forEach(ext => {
            const allRows = Array.from(document.querySelectorAll('div.client.row, div.tm-extra-pickup-row, div.tm-extra-dropoff-row'));
            const extraRow = document.createElement('div');
            extraRow.className = 'client row tm-extra-pickup-row';
            extraRow.style = "margin: 0; padding: 15px 0; background-color: #fff9d6; text-align: left; clear:both; position: relative; left: 50%; right: 50%; margin-left: -50vw; margin-right: -50vw; width: 100vw; box-sizing: border-box;";

            const hasAddress = !!(ext.address && ext.address.trim());
            const mapsBtnHtml = hasAddress
                ? `<button class="btn tm-maps-btn" onclick="window.open('https://www.google.com/maps?q=${encodeURIComponent(ext.address || '')}', '_blank')">📍</button>`
                : '';

            extraRow.innerHTML = `<div class="col" style="text-align: left;">
                <div class="tm-button-cluster">${mapsBtnHtml}</div>
                <div class="tm-client-header-container" data-client-name="${ext.name}">
                    <strong>${ext.name}</strong><br>${ext.address || ''}<br><div class="tm-pickup-tag">menu ophalen</div>
                </div>
            </div>`;

            if (ext.after === '__FIRST__') {
                const firstClientRow = allRows.find(r => r.classList.contains('client') && r.classList.contains('row') && !r.classList.contains('tm-extra-pickup-row') && !r.classList.contains('tm-extra-dropoff-row'));
                if (firstClientRow) {
                    firstClientRow.before(extraRow);
                }
            } else {
                const targetRow = allRows.find(r => {
                    const h = r.querySelector('.tm-client-header-container');
                    return h && h.dataset.clientName === ext.after;
                });
                if (targetRow) {
                    targetRow.after(extraRow);
                }
            }
        });
    }

    function applyDropoffsToUI() {
        const data = loadDropoffData();
        document.querySelectorAll('.tm-dropoff-tag').forEach(el => el.remove());
        document.querySelectorAll('.tm-extra-dropoff-row').forEach(el => el.remove());

        document.querySelectorAll('.tm-client-header-container').forEach(h => {
            if (data.normal.includes(h.dataset.clientName)) {
                let txt = 'menu afgeven';
                if (data.samen.includes(h.dataset.clientName)) {
                    txt += ' + samen invullen';
                }
                h.innerHTML += `<div class="tm-dropoff-tag">${txt}</div>`;
            }
        });

        data.extra.forEach(ext => {
            const allRows = Array.from(document.querySelectorAll('div.client.row, div.tm-extra-pickup-row, div.tm-extra-dropoff-row'));
            const extraRow = document.createElement('div');
            extraRow.className = 'client row tm-extra-dropoff-row';
            extraRow.style = "margin: 0; padding: 15px 0; background-color: #e0f7fa; text-align: left; clear:both; position: relative; left: 50%; right: 50%; margin-left: -50vw; margin-right: -50vw; width: 100vw; box-sizing: border-box;";

            const hasAddress = !!(ext.address && ext.address.trim());
            const mapsBtnHtml = hasAddress
                ? `<button class="btn tm-maps-btn" onclick="window.open('https://www.google.com/maps?q=${encodeURIComponent(ext.address || '')}', '_blank')">📍</button>`
                : '';

            let txt = 'menu afgeven';
            if (ext.samen) txt += ' + samen invullen';

            extraRow.innerHTML = `<div class="col" style="text-align: left;">
                <div class="tm-button-cluster">${mapsBtnHtml}</div>
                <div class="tm-client-header-container" data-client-name="${ext.name}">
                    <strong>${ext.name}</strong><br>${ext.address || ''}<br><div class="tm-dropoff-tag">${txt}</div>
                </div>
            </div>`;

            if (ext.after === '__FIRST__') {
                const firstClientRow = allRows.find(r => r.classList.contains('client') && r.classList.contains('row') && !r.classList.contains('tm-extra-pickup-row') && !r.classList.contains('tm-extra-dropoff-row'));
                if (firstClientRow) {
                    firstClientRow.before(extraRow);
                }
            } else {
                const targetRow = allRows.find(r => {
                    const h = r.querySelector('.tm-client-header-container');
                    return h && h.dataset.clientName === ext.after;
                });
                if (targetRow) {
                    targetRow.after(extraRow);
                }
            }
        });
    }

    function applyComponentsToUI() {
        const data = loadComponentsData();
        document.querySelectorAll('.tm-component-extra').forEach(el => el.remove());

        document.querySelectorAll('.tm-menu-char-hook').forEach(el => {
            const menuType = el.getAttribute('data-tm-menu');
            if (!menuType) return;
            let htmlToAppend = '';
            data.components.forEach(c => {
                if (c.menu === menuType) {
                    htmlToAppend += ` <span class="tm-component-extra">${c.text}</span>`;
                }
            });
            if (htmlToAppend) {
                el.insertAdjacentHTML('afterend', htmlToAppend);
            }
        });
    }

    function processColumns() {
        const DIETARY_CODES = ["avvz", "vgvis", "gnvis", "dia", "lv", "gesneden", "vlgmi", "gemixt", "-e", "e-"];

        if (!document.getElementById('tm-pickup-manager-btn')) {
            const firstRow = document.querySelector('div.client.row');
            if (firstRow) {
                const btn = document.createElement('button');
                btn.id = 'tm-pickup-manager-btn';
                btn.innerHTML = '📋 Menu Pickups Instellen';
                btn.style = `display: block; width: calc(100% - 20px); margin: 10px auto; padding: 15px; background: ${PICKUP_COLOR}; color: #333; border: 2px solid #d4ac0d; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; text-align: center;`;
                btn.onclick = openPickupManager;
                firstRow.parentNode.insertBefore(btn, firstRow);

                const btn3 = document.createElement('button');
                btn3.id = 'tm-dropoff-manager-btn';
                btn3.innerHTML = '📬 Menu Afgeven Instellen';
                btn3.style = `display: block; width: calc(100% - 20px); margin: 10px auto; padding: 15px; background: ${DROPOFF_COLOR}; color: white; border: 2px solid #117a8b; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; text-align: center;`;
                btn3.onclick = openDropoffManager;
                firstRow.parentNode.insertBefore(btn3, firstRow);

                const btn2 = document.createElement('button');
                btn2.id = 'tm-components-manager-btn';
                btn2.innerHTML = '🍔 Extra Componenten Instellen';
                btn2.style = `display: block; width: calc(100% - 20px); margin: 10px auto; padding: 15px; background: #e67e22; color: white; border: 2px solid #d35400; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; text-align: center;`;
                btn2.onclick = openComponentsManager;
                firstRow.parentNode.insertBefore(btn2, firstRow);
            }
        }

        const rows = document.querySelectorAll('div.client.row:not([data-tm-processed]):not(.tm-extra-pickup-row):not(.tm-extra-dropoff-row)');
        if (rows.length === 0) return;

        const dessertFrequency = {};
        document.querySelectorAll('div.col').forEach(col => {
            // Support both 1- and 2-digit day/month: e.g. 1/03/2026: or 01/03/2026:
            const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}:/g;
            const blocks = col.innerHTML.split(/(?=\d{1,2}\/\d{1,2}\/\d{4}:)/);
            blocks.forEach(block => {
                const dateMatch = block.match(dateRegex);
                if (!dateMatch || block.toLowerCase().includes("geen maaltijd")) return;
                const date = dateMatch[0].replace(':', '');
                const items = block.split(';').map(i => i.replace(/<[^>]*>/g, '').trim()).filter(i => i !== "");
                let foundDessert = "";
                items.forEach(item => {
                    const low = item.toLowerCase();
                    if (!low.includes('[') && !low.includes('soep') && !low.includes('+') && !low.includes('geen g') && !DIETARY_CODES.some(code => low.includes(code)) && low !== date.toLowerCase()) {
                        if (!foundDessert) foundDessert = item;
                    }
                });
                if (foundDessert) {
                    if (!dessertFrequency[date]) dessertFrequency[date] = {};
                    dessertFrequency[date][foundDessert] = (dessertFrequency[date][foundDessert] || 0) + 1;
                }
            });
        });

        const dailyStandard = {};
        for (const date in dessertFrequency) {
            dailyStandard[date] = Object.keys(dessertFrequency[date]).reduce((a, b) => dessertFrequency[date][a] > dessertFrequency[date][b] ? a : b);
        }

        rows.forEach(row => {
            const mainCol = row.querySelector('div.col');
            const sideCol = row.querySelector('div.col-3');
            if (!mainCol) return;

            const originalMainHTML = mainCol.innerHTML;
            const originalSideHTML = sideCol ? sideCol.innerHTML : '';

            // Fix ZZ formatting: remove space/dot before [ZZ]
            let html = mainCol.innerHTML.replace(/\s*\.?\s*za\b/gi, "[ZZ]");

            const actionButtons = sideCol ? Array.from(sideCol.querySelectorAll(':scope > button, :scope > a')) : [];
            const modals = sideCol ? Array.from(sideCol.querySelectorAll('.modal')) : [];

            const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}:/g;
            const firstDateMatch = html.match(dateRegex);
            if (!firstDateMatch) { row.setAttribute('data-tm-processed', 'true'); return; }

            const addressEndIndex = html.indexOf(firstDateMatch[0]);
            const nameAndAddressHtml = html.substring(0, addressEndIndex);
            const addressLines = nameAndAddressHtml.split('<br>').map(s => s.replace(/<[^>]*>/g, '').trim()).filter(s => s !== "");
            const rawClientName = addressLines[0];
            const streetAndCity = addressLines.slice(1).join(', ');

            const mapsBtn = document.createElement('button');
            mapsBtn.className = 'btn tm-maps-btn';
            mapsBtn.innerHTML = '📍';
            mapsBtn.onclick = () => window.open(`https://www.google.com/maps?q=${encodeURIComponent(streetAndCity)}`, '_blank');

            const infoStartIndex = html.indexOf('<strong>Klant-info:</strong>');
            const menuSectionRaw = html.substring(addressEndIndex, infoStartIndex > -1 ? infoStartIndex : html.length);
            const remainingHtml = infoStartIndex > -1 ? html.substring(infoStartIndex) : "";

            const dayBlocks = menuSectionRaw.split(/(?=\d{1,2}\/\d{1,2}\/\d{4}:)/).filter(b => b.trim() !== "");
            let cardsHtml = "";
            let rowWarm = 0, rowCold = 0, rowSoups = 0, rowSoupsZZ = 0, rowSoupsBouillon = 0, rowDessertTypes = {};
            dayBlocks.forEach(block => {
                const dateHeaderRaw = block.match(dateRegex)[0];
                const dateKey = dateHeaderRaw.replace(':', '');
                const contentRaw = block.replace(dateHeaderRaw, "").trim();
                let dayCardBody = "";

                if (contentRaw.toLowerCase().includes("geen maaltijd")) {
                    dayCardBody = `<div class="tm-no-meal">[Geen maaltijd]</div>`;
                } else {
                    const items = contentRaw.split(';').map(item => item.replace(/<[^>]*>/g, '').trim()).filter(item => item !== "");
                    let menuLabel = "Onbekend", soep = "Gewoon", dessert = "", andere = [], soepIsEx = false, menuClass = "tm-menu-default", blockHasSoepZZ = false, soepExtraLabel = "";
                    let menuChar = "";

                    items.forEach(item => {
                        const low = item.toLowerCase();
                        const hasZZ = item.includes('[ZZ]');
                        // Clean up internal spacing for ZZ
                        let cleanedItem = item.replace(/\s*\.\s*\[ZZ\]/gi, '[ZZ]').replace(/\s+\[ZZ\]/gi, '[ZZ]');
                        const zzOnly = cleanedItem.replace(/\[ZZ\]/gi, '').trim() === "";
                        if (zzOnly) {
                            return;
                        }

                        // + 1 G / + 2 Gewoon / + 1 ZZ = extra soup; only "+ N extra" gets green highlight, not the soep type
                        const extraSoepMatch = low.match(/^\s*\+\s*(\d+)\s*(.*)$/);
                        if (extraSoepMatch && /g|gewoon|zz|bouillon/.test(extraSoepMatch[2] || "")) {
                            const n = extraSoepMatch[1];
                            soepExtraLabel = "+ " + n + " extra";
                            const rest = (extraSoepMatch[2] || "").trim();
                            if (/zz/.test(rest)) soep = "ZZ";
                            else if (/bouillon/.test(rest)) soep = "Bouillon";
                            return;
                        }

                        if (item.includes('[') && item.includes(']') && !hasZZ) {
                            const match = item.match(/\[([A-F])\]/i);
                            if (match) {
                                const char = match[1].toUpperCase();
                                menuChar = char;
                                if (char === 'A' || char === 'B') { menuLabel = char + " - warm"; menuClass = "tm-menu-warm"; }
                                else if (char === 'C' || char === 'D') { menuLabel = char + " - koud"; menuClass = "tm-menu-koud"; }
                                else { menuLabel = char + " - warm"; }
                            }
                        }
                        else if (low.includes('soep') || low.includes('gn g') || low.includes('geen g')) {
                            soepIsEx = true;
                            if (low.includes('gn g') || low.includes('geen g')) {
                                soep = "geen soep";
                            } else {
                                if (hasZZ) blockHasSoepZZ = true;
                                let sName = cleanedItem.replace(/soep/gi, '').trim();
                                soep = sName || "Gewoon";
                            }
                        }
                        else if (DIETARY_CODES.some(code => low.includes(code))) { andere.push(cleanedItem); }
                        else if (dessert === "" && low !== "" && !hasZZ) { dessert = cleanedItem; }
                        else if (low !== "" && !hasZZ) { andere.push(cleanedItem); }
                    });

                    if (menuClass === "tm-menu-warm") rowWarm++;
                    else if (menuClass === "tm-menu-koud") rowCold++;
                    if (soep !== "geen soep") {
                        rowSoups++;
                        if (soep.toLowerCase().includes('bouillon')) rowSoupsBouillon++;
                    }
                    if (blockHasSoepZZ) rowSoupsZZ++;
                    const dessertName = (dessert || "Geen").trim();
                    if (dessertName) rowDessertTypes[dessertName] = (rowDessertTypes[dessertName] || 0) + 1;

                    const soepPart = soepIsEx ? '<span class="tm-soep-highlight">' + soep + '</span>' : soep;
                    const soepDisplay = soepPart + (soepExtraLabel ? ' <span class="tm-soep-extra">' + soepExtraLabel + '</span>' : '');
                    const isSpecial = dessert && dailyStandard[dateKey] && dessert !== dailyStandard[dateKey];
                    dayCardBody = `<div class="tm-meal-row tm-menu-line"><strong>Menu:</strong> <span class="${menuClass} tm-menu-char-hook" data-tm-menu="${menuChar}">${menuLabel}</span></div>
                                   <div class="tm-meal-row"><strong>Soep:</strong> ${soepDisplay}</div>
                                   <div class="tm-meal-row"><strong>Dessert:</strong> <span class="${isSpecial ? 'tm-dessert-special' : ''}">${dessert || "Geen"}</span></div>
                                   ${andere.length > 0 ? `<div class="tm-extra-info"><strong>Andere info:</strong> ${andere.join(", ")}</div>` : ''}`;
                }
                cardsHtml += `<div class="tm-day-card"><div class="tm-date-header">${dateKey}</div>${dayCardBody}</div>`;
            });
            row.dataset.tmWarm = rowWarm;
            row.dataset.tmCold = rowCold;
            row.dataset.tmSoups = rowSoups;
            row.dataset.tmSoupsZz = rowSoupsZZ;
            row.dataset.tmSoupsBouillon = rowSoupsBouillon;
            row.dataset.tmDessertTypes = JSON.stringify(rowDessertTypes);

            mainCol.innerHTML = "";
            mainCol.style.textAlign = "left";

            const btnCluster = document.createElement('div');
            btnCluster.className = 'tm-button-cluster';
            btnCluster.appendChild(mapsBtn);

            actionButtons.forEach(btn => {
                btn.classList.remove('btn-lg', 'mt-auto', 'mb-auto');
                btnCluster.appendChild(btn);

                if (btn.innerText.toLowerCase().includes('info') || btn.innerText.toLowerCase().includes('detail')) {
                    const origBtn = btn.cloneNode(true);
                    origBtn.innerHTML = "⏪ Origineel";
                    origBtn.removeAttribute('onclick');
                    origBtn.onclick = (e) => {
                        e.preventDefault();
                        const win = window.open("", "_blank", "width=800,height=600");
                        win.document.write(`<html><head><title>Origineel</title><link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"></head><body style="padding:20px;"><h3>Originele Info</h3><hr><div class="row"><div class="col">${originalMainHTML}</div><div class="col-3">${originalSideHTML}</div></div></body></html>`);
                    };
                    btnCluster.appendChild(origBtn);
                }
            });

            mainCol.appendChild(btnCluster);

            const headDiv = document.createElement('div');
            headDiv.className = 'tm-client-header-container';
            headDiv.dataset.clientName = rawClientName;
            headDiv.innerHTML = nameAndAddressHtml;
            mainCol.appendChild(headDiv);

            const bodyDiv = document.createElement('div');
            let dropdownHtml = "";
            if (remainingHtml.includes("<strong>Klant-info:</strong>")) {
                const parts = remainingHtml.split("<strong>Klant-info:</strong>");
                dropdownHtml = `<details class="tm-klant-dropdown"><summary>Klant-info </summary><div class="tm-klant-content"><strong>Klant-info:</strong>${parts[1]}</div></details>`;
            }
            bodyDiv.innerHTML = cardsHtml + dropdownHtml;
            mainCol.appendChild(bodyDiv);

            modals.forEach(modal => mainCol.appendChild(modal));
            if (sideCol) sideCol.remove();
            row.setAttribute('data-tm-processed', 'true');
        });

        applyPickupsToUI();
        applyDropoffsToUI();
        applyComponentsToUI();

        // Totals summary at top: sum from all client rows (processed, with data attributes)
        let totalWarm = 0, totalCold = 0, totalSoups = 0, totalSoupsZZ = 0, totalSoupsBouillon = 0, totalDessertTypes = {};
        document.querySelectorAll('div.client.row:not(.tm-extra-pickup-row)').forEach(r => {
            totalWarm += parseInt(r.dataset.tmWarm || '0', 10);
            totalCold += parseInt(r.dataset.tmCold || '0', 10);
            totalSoups += parseInt(r.dataset.tmSoups || '0', 10);
            totalSoupsZZ += parseInt(r.dataset.tmSoupsZz || '0', 10);
            totalSoupsBouillon += parseInt(r.dataset.tmSoupsBouillon || '0', 10);
            try {
                const types = JSON.parse(r.dataset.tmDessertTypes || '{}');
                for (const [name, count] of Object.entries(types)) {
                    totalDessertTypes[name] = (totalDessertTypes[name] || 0) + count;
                }
            } catch (e) { }
        });
        const soupExtras = [];
        if (totalSoupsZZ > 0) soupExtras.push(`${totalSoupsZZ} ZZ`);
        if (totalSoupsBouillon > 0) soupExtras.push(`${totalSoupsBouillon} Bouillon`);
        const soupSuffix = soupExtras.length ? ' (' + soupExtras.join(') (') + ')' : '';
        const dessertLines = Object.entries(totalDessertTypes)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => `<li><strong>${name}:</strong> ${count}</li>`)
            .join('');
        const container = document.querySelector('.container.text-center.py-5') || document.querySelector('main .container');
        if (container) {
            const firstChild = container.querySelector('h1');
            const insertAfter = firstChild ? firstChild.nextSibling : container.firstChild;

            let summaryEl = document.getElementById('tm-meal-summary');
            if (!summaryEl) {
                summaryEl = document.createElement('div');
                summaryEl.id = 'tm-meal-summary';
                summaryEl.className = 'tm-meal-summary';
                container.insertBefore(summaryEl, insertAfter);
            }
            summaryEl.innerHTML = `
                <div class="tm-dessert-bak-title">Maaltijden & Soep overzicht</div>
                <ul class="tm-dessert-list">
                    <li><strong>Totaal warme maaltijden:</strong> ${totalWarm}</li>
                    <li><strong>Totaal soep:</strong> ${totalSoups}${soupSuffix}</li>
                </ul>
            `;

            let dessertBox = document.getElementById('tm-dessert-bak-summary');
            if (!dessertBox) {
                dessertBox = document.createElement('div');
                dessertBox.id = 'tm-dessert-bak-summary';
                dessertBox.className = 'tm-dessert-bak-box';
                summaryEl.after(dessertBox);
            }
            dessertBox.innerHTML = `
                <div class="tm-dessert-bak-title">Dessert bak</div>
                <ul class="tm-dessert-list">
                    <li><strong>koude schotels:</strong> ${totalCold}</li>
                    ${dessertLines}
                </ul>
            `;
        }
    }

    function openPickupManager() {
        const data = loadPickupData();
        const clients = [];
        document.querySelectorAll('.tm-client-header-container').forEach((h) => {
            const name = h.dataset.clientName;
            if (name && !clients.includes(name) && !h.closest('.tm-extra-pickup-row')) clients.push(name);
        });

        // Build route order so "na wie" options and list mirror actual sequence:
        // start with base clients, then handle extras, including those before the first client.
        const FIRST_ANCHOR = '__FIRST__';
        const routeOrder = clients.slice();
        data.extra.forEach(ext => {
            if (!ext.name) return;
            if (ext.after === FIRST_ANCHOR) {
                if (!routeOrder.includes(ext.name)) {
                    routeOrder.unshift(ext.name);
                }
                return;
            }
            const anchorIndex = routeOrder.indexOf(ext.after);
            if (anchorIndex !== -1) {
                if (!routeOrder.includes(ext.name)) {
                    routeOrder.splice(anchorIndex + 1, 0, ext.name);
                }
            } else if (!routeOrder.includes(ext.name)) {
                routeOrder.push(ext.name);
            }
        });

        const overlay = document.createElement('div');
        overlay.id = 'tm-overlay';
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; display:flex; align-items:center; justify-content:center;";
        const modal = document.createElement('div');
        modal.style = "background:white; padding:20px; border-radius:10px; width:95%; max-width:400px; max-height:85vh; overflow-y:auto;";

        let listHtml = '<h3>Menu ophalen bij:</h3>';
        // Single unified list in route order:
        routeOrder.forEach(name => {
            if (clients.includes(name)) {
                // Base client: checkbox to mark pickup (display name: first + middle, last)
                const isChecked = data.normal.includes(name) ? 'checked' : '';
                listHtml += `<div style="margin-bottom:8px; display:flex; flex-direction:column; border-bottom:1px solid #eee; padding-bottom:5px;">
                                <label style="font-weight:bold;"><input type="checkbox" class="tm-pickup-check" value="${name}" ${isChecked}> ${swapDisplayName(name)}</label>
                             </div>`;
            } else {
                // Extra stop: only name visible here, with remove icon button on the left
                const idx = data.extra.findIndex(ext => ext.name === name);
                const ext = idx >= 0 ? data.extra[idx] : { name };
                listHtml += `<div style="margin-bottom:8px; display:flex; align-items:flex-start; border-bottom:1px solid #eee; padding-bottom:5px;">
                                <button type="button" class="tm-extra-remove-btn" data-extra-index="${idx}" style="margin-right:8px; color:#d00000; background:none; border:none; font-size:22px; cursor:pointer;">✖</button>
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-weight:bold;">${swapDisplayName(ext.name)}</span>
                                </div>
                             </div>`;
            }
        });

        listHtml += '<hr><h4>Extra Stop</h4><input type="text" id="tm-ex-name" placeholder="Naam" style="width:100%; margin-bottom:8px;"><input type="text" id="tm-ex-addr" placeholder="Adres (optioneel)" style="width:100%; margin-bottom:8px;"><select id="tm-ex-after" style="width:100%; margin-bottom:8px;"><option value="">-- Na wie? --</option>';
        routeOrder.forEach(name => listHtml += `<option value="${name}">${swapDisplayName(name)}</option>`);
        listHtml += '</select><button id="tm-ex-before-first" style="width:100%; margin-bottom:8px; background:#eeeeee; color:#333; border:none; padding:8px;">Voor eerste klant</button><button id="tm-save-all" style="width:100%; margin-top:10px; background:#34a853; color:white; border:none; padding:10px;">Opslaan</button><button id="tm-close-all" style="width:100%; margin-top:8px; background:#cccccc; color:#333; border:none; padding:10px;">Sluiten</button>';

        modal.innerHTML = listHtml;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close when clicking outside the modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.getElementById('tm-overlay')?.remove();
            }
        });

        // Live clear error state on "Na wie?" when user selects a value
        const exAfterSelect = document.getElementById('tm-ex-after');
        if (exAfterSelect) {
            exAfterSelect.addEventListener('change', () => {
                exAfterSelect.classList.remove('tm-ex-after-error');
            });
        }

        document.getElementById('tm-save-all').onclick = () => {
            data.normal = Array.from(document.querySelectorAll('.tm-pickup-check:checked')).map(c => c.value);
            const n = document.getElementById('tm-ex-name').value;
            const afterSelect = document.getElementById('tm-ex-after');
            const a = afterSelect.value;

            // Clear previous error state on "Na wie?"
            if (afterSelect) {
                afterSelect.classList.remove('tm-ex-after-error');
            }

            // If a name is entered but no "Na wie" is chosen, show visual error and do nothing else
            if (n && !a) {
                if (afterSelect) {
                    afterSelect.classList.add('tm-ex-after-error');
                    afterSelect.focus();
                }
                return;
            }

            if (n && a) {
                data.extra.push({ name: n, address: document.getElementById('tm-ex-addr').value, after: a });
            }
            savePickupData(data);
            applyPickupsToUI();
            
            // Close manager entirely
            document.getElementById('tm-overlay')?.remove();
        };

        // Button to add an extra stop before the very first client
        const beforeFirstBtn = document.getElementById('tm-ex-before-first');
        if (beforeFirstBtn) {
            beforeFirstBtn.onclick = () => {
                const n = document.getElementById('tm-ex-name').value;
                const addr = document.getElementById('tm-ex-addr').value;
                const afterSelect = document.getElementById('tm-ex-after');

                // Clear any previous "Na wie" error styling
                if (afterSelect) {
                    afterSelect.classList.remove('tm-ex-after-error');
                }

                if (!n) {
                    document.getElementById('tm-ex-name').focus();
                    return;
                }

                data.extra.push({ name: n, address: addr, after: '__FIRST__' });
                savePickupData(data);
                applyPickupsToUI();
                document.getElementById('tm-overlay')?.remove();
                openPickupManager();
            };
        }

        // Remove existing extra stop buttons (keep manager open by re-rendering it)
        document.querySelectorAll('.tm-extra-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-extra-index'), 10);
                if (!isNaN(idx)) {
                    const removed = data.extra[idx];
                    // Remove the selected extra stop
                    data.extra.splice(idx, 1);
                    // Any extra that was after the removed one should now be after the removed one's anchor
                    if (removed && removed.name) {
                        data.extra.forEach(ext => {
                            if (ext.after === removed.name) {
                                ext.after = removed.after;
                            }
                        });
                    }
                    savePickupData(data);
                    applyPickupsToUI();
                    // Reopen manager with updated data so popup stays visible
                    document.getElementById('tm-overlay')?.remove();
                    openPickupManager();
                }
            });
        });

        // Close button without saving
        document.getElementById('tm-close-all').onclick = () => {
            document.getElementById('tm-overlay')?.remove();
        };
    }

    function openComponentsManager() {
        const data = loadComponentsData();

        const overlay = document.createElement('div');
        overlay.id = 'tm-overlay-components';
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; display:flex; align-items:center; justify-content:center;";
        const modal = document.createElement('div');
        modal.style = "background:white; padding:20px; border-radius:10px; width:95%; max-width:400px; max-height:85vh; overflow-y:auto;";

        let listHtml = '<h3>Extra Componenten toevoegen</h3>';

        data.components.forEach((c, idx) => {
            listHtml += `<div style="margin-bottom:8px; display:flex; align-items:center;">
                            <button type="button" class="tm-comp-remove-btn" data-comp-index="${idx}" style="margin-right:8px; color:#d00000; background:none; border:none; font-size:22px; cursor:pointer;">✖</button>
                            <span><strong>Menu ${c.menu}:</strong> ${c.text}</span>
                         </div>`;
        });

        listHtml += '<hr><h4>Nieuw Component</h4>';
        listHtml += '<select id="tm-comp-menu" style="width:100%; margin-bottom:8px; padding:5px;"><option value="A">Menu A</option><option value="B">Menu B</option><option value="C">Menu C</option><option value="D">Menu D</option></select>';
        listHtml += '<input type="text" id="tm-comp-text" placeholder="Bv. mayonnaise of tomatn" style="width:100%; margin-bottom:8px; padding:5px;">';
        listHtml += '<button id="tm-comp-save" style="width:100%; margin-top:10px; background:#e67e22; color:white; border:none; padding:10px; border-radius:5px; font-weight:bold; cursor:pointer;">Toevoegen</button>';
        listHtml += '<button id="tm-comp-close" style="width:100%; margin-top:8px; background:#cccccc; color:#333; border:none; padding:10px; border-radius:5px; font-weight:bold; cursor:pointer;">Sluiten</button>';

        modal.innerHTML = listHtml;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.getElementById('tm-overlay-components')?.remove();
            }
        });

        document.getElementById('tm-comp-save').onclick = () => {
            const m = document.getElementById('tm-comp-menu').value;
            const t = document.getElementById('tm-comp-text').value.trim();
            if (m && t) {
                data.components.push({ menu: m, text: t });
                saveComponentsData(data);

                // Refresh popup implicitly by reopening
                document.getElementById('tm-overlay-components')?.remove();
                openComponentsManager();

                applyComponentsToUI();
            }
        };

        document.querySelectorAll('.tm-comp-remove-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(btn.getAttribute('data-comp-index'), 10);
                data.components.splice(idx, 1);
                saveComponentsData(data);

                // Refresh popup implicitly by reopening
                document.getElementById('tm-overlay-components')?.remove();
                openComponentsManager();

                applyComponentsToUI();
            };
        });

        document.getElementById('tm-comp-close').onclick = () => {
            document.getElementById('tm-overlay-components')?.remove();
        };
    }

    function openDropoffManager() {
        const data = loadDropoffData();
        const clients = [];
        document.querySelectorAll('.tm-client-header-container').forEach((h) => {
            const name = h.dataset.clientName;
            if (name && !clients.includes(name) && !h.closest('.tm-extra-pickup-row') && !h.closest('.tm-extra-dropoff-row')) clients.push(name);
        });

        // Build route order so "na wie" options and list mirror actual sequence:
        const FIRST_ANCHOR = '__FIRST__';
        const routeOrder = clients.slice();
        data.extra.forEach(ext => {
            if (!ext.name) return;
            if (ext.after === FIRST_ANCHOR) {
                if (!routeOrder.includes(ext.name)) routeOrder.unshift(ext.name);
                return;
            }
            const anchorIndex = routeOrder.indexOf(ext.after);
            if (anchorIndex !== -1) {
                if (!routeOrder.includes(ext.name)) routeOrder.splice(anchorIndex + 1, 0, ext.name);
            } else if (!routeOrder.includes(ext.name)) {
                routeOrder.push(ext.name);
            }
        });

        const overlay = document.createElement('div');
        overlay.id = 'tm-overlay-dropoff';
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; display:flex; align-items:center; justify-content:center;";
        const modal = document.createElement('div');
        modal.style = "background:white; padding:20px; border-radius:10px; width:95%; max-width:400px; max-height:85vh; overflow-y:auto;";

        let listHtml = '<h3>Menu afgeven bij:</h3>';
        routeOrder.forEach(name => {
            if (clients.includes(name)) {
                const isChecked = data.normal.includes(name) ? 'checked' : '';
                const isSamen = data.samen.includes(name) ? 'checked' : '';
                listHtml += `<div style="margin-bottom:8px; display:flex; flex-direction:column; border-bottom:1px solid #eee; padding-bottom:5px;">
                                <label style="font-weight:bold;"><input type="checkbox" class="tm-dropoff-check" value="${name}" ${isChecked}> ${swapDisplayName(name)}</label>
                                <label style="margin-left:25px; font-size:0.9em;"><input type="checkbox" class="tm-dropoff-samen" value="${name}" ${isSamen}> + Samen invullen</label>
                             </div>`;
            } else {
                const idx = data.extra.findIndex(ext => ext.name === name);
                const ext = idx >= 0 ? data.extra[idx] : { name, samen: false };
                const isSamen = ext.samen ? 'checked' : '';
                listHtml += `<div style="margin-bottom:8px; display:flex; align-items:flex-start; border-bottom:1px solid #eee; padding-bottom:5px;">
                                <button type="button" class="tm-extra-dropoff-remove-btn" data-extra-index="${idx}" style="margin-right:8px; color:#d00000; background:none; border:none; font-size:22px; cursor:pointer;">✖</button>
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-weight:bold;">${swapDisplayName(ext.name)}</span>
                                    <label style="font-size:0.9em; margin-top:2px;"><input type="checkbox" class="tm-extra-dropoff-samen" data-extra-index="${idx}" ${isSamen}> + Samen invullen</label>
                                </div>
                             </div>`;
            }
        });

        listHtml += '<hr><h4>Extra Stop (Afgeven)</h4><input type="text" id="tm-ex-do-name" placeholder="Naam" style="width:100%; margin-bottom:8px;"><input type="text" id="tm-ex-do-addr" placeholder="Adres (optioneel)" style="width:100%; margin-bottom:8px;"><label style="display:block; margin-bottom:8px;"><input type="checkbox" id="tm-ex-do-samen"> Samen invullen</label><select id="tm-ex-do-after" style="width:100%; margin-bottom:8px;"><option value="">-- Na wie? --</option>';
        routeOrder.forEach(name => listHtml += `<option value="${name}">${swapDisplayName(name)}</option>`);
        listHtml += '</select><button id="tm-ex-do-before-first" style="width:100%; margin-bottom:8px; background:#eeeeee; color:#333; border:none; padding:8px;">Voor eerste klant</button><button id="tm-do-save-all" style="width:100%; margin-top:10px; background:#17a2b8; color:white; border:none; padding:10px;">Opslaan</button><button id="tm-do-close-all" style="width:100%; margin-top:8px; background:#cccccc; color:#333; border:none; padding:10px;">Sluiten</button>';

        modal.innerHTML = listHtml;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) document.getElementById('tm-overlay-dropoff')?.remove();
        });

        const exAfterSelect = document.getElementById('tm-ex-do-after');
        if (exAfterSelect) exAfterSelect.addEventListener('change', () => exAfterSelect.classList.remove('tm-ex-after-error'));

        document.getElementById('tm-do-save-all').onclick = () => {
            data.normal = Array.from(document.querySelectorAll('.tm-dropoff-check:checked')).map(c => c.value);
            data.samen = Array.from(document.querySelectorAll('.tm-dropoff-samen:checked:not(.tm-extra-dropoff-samen)')).map(c => c.value);
            
            // update extras samen status
            document.querySelectorAll('.tm-extra-dropoff-samen').forEach(cb => {
                const idx = parseInt(cb.getAttribute('data-extra-index'), 10);
                if (data.extra[idx]) data.extra[idx].samen = cb.checked;
            });

            const n = document.getElementById('tm-ex-do-name').value;
            const a = document.getElementById('tm-ex-do-after').value;
            const s = document.getElementById('tm-ex-do-samen').checked;

            if (n && !a && exAfterSelect) {
                exAfterSelect.classList.add('tm-ex-after-error');
                exAfterSelect.focus();
                return;
            }

            if (n && a) {
                data.extra.push({ name: n, address: document.getElementById('tm-ex-do-addr').value, after: a, samen: s });
            }
            saveDropoffData(data);
            applyDropoffsToUI();
            document.getElementById('tm-overlay-dropoff')?.remove();
        };

        const beforeFirstBtn = document.getElementById('tm-ex-do-before-first');
        if (beforeFirstBtn) {
            beforeFirstBtn.onclick = () => {
                const n = document.getElementById('tm-ex-do-name').value;
                const addr = document.getElementById('tm-ex-do-addr').value;
                const s = document.getElementById('tm-ex-do-samen').checked;
                
                // Also save current checkboxes
                data.normal = Array.from(document.querySelectorAll('.tm-dropoff-check:checked')).map(c => c.value);
                data.samen = Array.from(document.querySelectorAll('.tm-dropoff-samen:checked:not(.tm-extra-dropoff-samen)')).map(c => c.value);
                document.querySelectorAll('.tm-extra-dropoff-samen').forEach(cb => {
                    const idx = parseInt(cb.getAttribute('data-extra-index'), 10);
                    if (data.extra[idx]) data.extra[idx].samen = cb.checked;
                });

                if (exAfterSelect) exAfterSelect.classList.remove('tm-ex-after-error');
                if (!n) {
                    document.getElementById('tm-ex-do-name').focus();
                    return;
                }
                data.extra.push({ name: n, address: addr, after: '__FIRST__', samen: s });
                saveDropoffData(data);
                applyDropoffsToUI();
                document.getElementById('tm-overlay-dropoff')?.remove();
                openDropoffManager();
            };
        }

        document.querySelectorAll('.tm-extra-dropoff-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // save checkboxes before remove
                data.normal = Array.from(document.querySelectorAll('.tm-dropoff-check:checked')).map(c => c.value);
                data.samen = Array.from(document.querySelectorAll('.tm-dropoff-samen:checked:not(.tm-extra-dropoff-samen)')).map(c => c.value);

                const idx = parseInt(btn.getAttribute('data-extra-index'), 10);
                if (!isNaN(idx)) {
                    const removed = data.extra[idx];
                    data.extra.splice(idx, 1);
                    if (removed && removed.name) {
                        data.extra.forEach(ext => {
                            if (ext.after === removed.name) ext.after = removed.after;
                        });
                    }
                    saveDropoffData(data);
                    applyDropoffsToUI();
                    document.getElementById('tm-overlay-dropoff')?.remove();
                    openDropoffManager();
                }
            });
        });

        document.getElementById('tm-do-close-all').onclick = () => {
            document.getElementById('tm-overlay-dropoff')?.remove();
        };
    }

    const style = document.createElement('style');
    style.innerHTML = `
        .tm-meal-summary { text-align: left; margin-bottom: 1rem; padding: 0.75rem 1rem; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6; }
        .tm-summary-line { font-size: 1rem; }
        .tm-dessert-bak-box { text-align: left; margin-bottom: 1rem; padding: 0.75rem 1rem; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6; }
        .tm-dessert-bak-title { font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem; }
        .tm-dessert-list { margin: 0; padding: 0; list-style-type: none; border: 1px solid #dee2e6; border-radius: 4px; overflow: hidden; }
        .tm-dessert-list li { font-size: 1rem; padding: 6px 10px; margin: 0; border-bottom: 1px solid #dee2e6; }
        .tm-dessert-list li:last-child { border-bottom: none; }
        .tm-dessert-list li:nth-child(even) { background-color: #f1f3f5; }
        .tm-dessert-list li:nth-child(odd) { background-color: #ffffff; }
        .tm-button-cluster { float: right; display: flex; flex-direction: row; gap: 8px; margin-left: 10px; }
        .tm-button-cluster .btn, .tm-button-cluster a {
            display: inline-flex !important; align-items: center; justify-content: center;
            min-width: 48px !important; height: 48px !important;
            padding: 10px !important; font-size: 1.1rem; border-radius: 8px; font-weight: bold;
        }
        .tm-maps-btn { background-color: #540429 !important; color: white !important; }
        .tm-day-card { clear: both; background: #fff; border: 1px solid #ddd; border-radius: 6px; margin: 8px 0; padding: 10px; }
        .tm-date-header { font-weight: bold; border-bottom: 1px solid #eee; margin-bottom: 5px; }
        .tm-menu-line { font-weight: bold; }
        .tm-menu-warm { background-color: #f8d7da; color: #721c24; padding: 1px 4px; border-radius: 4px; }
        .tm-menu-koud { background-color: #a2d9e7; color: #0c5460; padding: 1px 4px; border-radius: 4px; }
        .tm-soep-highlight { background-color: #fff3cd; font-weight: bold; padding: 1px 4px; border-radius: 4px; }
        .tm-soep-extra { background-color: #d4edda; color: #155724; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-left: 4px; }
        .tm-component-extra { background-color: #ffe0b2; color: #e65100; font-weight: bold; padding: 1px 6px; border-radius: 4px; margin-left: 6px; border: 1px solid #ffb74d; }
        .tm-dessert-special { background-color: #ffe8cc; font-weight: bold; padding: 1px 4px; border-radius: 4px; }
        .tm-extra-info { color: #888; margin-top: 5px; font-size: 0.95em; }
        .tm-pickup-tag { background: ${PICKUP_COLOR}; color: #333; padding: 4px 8px; font-weight: bold; border-radius: 4px; display: inline-block; margin-top: 5px; margin-right: 5px; }
        .tm-dropoff-tag { background: ${DROPOFF_COLOR}; color: white; padding: 4px 8px; font-weight: bold; border-radius: 4px; display: inline-block; margin-top: 5px; margin-right: 5px; }
        .tm-pickup-check {
            margin-right: 8px;
        }
        .tm-extra-remove-btn {
            width: 26px;
            height: 26px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            margin-right: 8px;
            background: transparent;
            color: #d00000;
            border: none;
            border-radius: 0;
            font-size: 22px;
            font-weight: 900;
            line-height: 1;
        }
        .tm-ex-after-error {
            border: 2px solid #d00000 !important;
            background-color: #ffe5e5 !important;
        }
        .tm-klant-dropdown { margin-top: 10px; border: 1px solid #ccc; border-radius: 5px; background: #fdfdfd; }
        .tm-klant-dropdown summary { cursor: pointer; font-weight: bold; color: #0056b3; padding: 5px; }
        .tm-klant-content { padding: 8px; border-top: 1px solid #eee; background: white; }
    `;
    document.head.appendChild(style);

    const observer = new MutationObserver(() => processColumns());
    observer.observe(document.body, { childList: true, subtree: true });
    processColumns();
})();
