/**
 * @Author      WDCi ()
 * @Date        April 2026
 * @group       Formula Builder
 * @Description JavaScript controller for the formulaBuilder LWC.
 *              Provides a visual formula editor that loads a field's current formula
 *              from a record, allows editing with operator shortcuts and custom metadata
 *              type insertion, supports syntax verification, and persists changes via
 *              a dedicated Apex controller.
 * @changehistory
 * ISS-002768 2026-04-03 WDCi - Initial development of Formula Builder LWC
 */
import { LightningElement, api, track, wire } from 'lwc';
import { registerRefreshHandler, unregisterRefreshHandler } from 'lightning/refresh';
import { promptSuccess, promptError, promptWarning } from 'c/toasterUtil';
import { getErrorMessage, logInfo } from 'c/loggingUtil';
import { initCacheIdx } from 'c/lwcUtil';

import getFieldValue         from '@salesforce/apex/REDU_FormulaBuilder_LCTRL.getFieldValue';
import updateFieldValue      from '@salesforce/apex/REDU_FormulaBuilder_LCTRL.updateFieldValue';
import getCustomMetadataTypes from '@salesforce/apex/REDU_FormulaBuilder_LCTRL.getCustomMetadataTypes';
import verifyFormula         from '@salesforce/apex/REDU_FormulaBuilder_LCTRL.verifyFormula';

// ── Labels ───────────────────────────────────────────────────────────────────
const LABEL_VERIFY_SUCCESS  = 'Formula syntax is valid.';
const LABEL_SAVE_SUCCESS    = 'Formula saved successfully.';
const LABEL_NO_RECORD       = 'A Record Id is required to load or save a formula.';
const COMPONENT_NAME        = 'formulaBuilder';

// ── Operator tokens shown in the toolbar ─────────────────────────────────────
const OPERATOR_TOKENS = [
    { label: 'AND',  value: ' && ' },
    { label: 'OR',   value: ' || ' },
    { label: 'NOT',  value: '!' },
    { label: '=',    value: ' == ' },
    { label: '!=',   value: ' != ' },
    { label: '>',    value: ' > ' },
    { label: '<',    value: ' < ' },
    { label: '>=',   value: ' >= ' },
    { label: '<=',   value: ' <= ' },
    { label: '(',    value: '(' },
    { label: ')',    value: ')' },
    { label: 'LIKE', value: ' LIKE ' },
    { label: 'IN',   value: ' IN ' },
    { label: 'NULL', value: 'null' }
];

export default class FormulaBuilder extends LightningElement {

    // ── Public API properties ─────────────────────────────────────────────────

    /** @description API name of the Salesforce object (e.g. Study_Requirement_Set__c) */
    @api objectApiName;

    /** @description API name of the formula/criteria field (e.g. Criteria__c) */
    @api fieldApiName;

    /** @description Record Id used to load and save the formula value */
    @api recordId;

    // ── Private tracked state ─────────────────────────────────────────────────

    @track formulaValue         = '';
    @track originalFormulaValue = '';
    @track spinnerCount         = 0;
    @track verifyResult         = null;   // { isValid, errorMessage }
    @track metadataTypeOptions  = [];
    @track selectedMetadataType = '';
    @track cacheIdx             = initCacheIdx();

    // ── Internal ──────────────────────────────────────────────────────────────

    _refreshHandlerRef;
    _cursorPosition = 0;

    // ── Lifecycle hooks ───────────────────────────────────────────────────────

    connectedCallback() {
        this._refreshHandlerRef = registerRefreshHandler(this, this.handleRefresh.bind(this));
        logInfo(COMPONENT_NAME, 'connectedCallback', 'Component connected.');
    }

    disconnectedCallback() {
        unregisterRefreshHandler(this._refreshHandlerRef);
        logInfo(COMPONENT_NAME, 'disconnectedCallback', 'Component disconnected.');
    }

    // ── Wire: getFieldValue ───────────────────────────────────────────────────

    @wire(getFieldValue, {
        objectApiName : '$objectApiName',
        fieldApiName  : '$fieldApiName',
        recordId      : '$recordId',
        cacheIdx      : '$cacheIdx'
    })
    wiredFieldValue({ error, data }) {
        if (data) {
            logInfo(COMPONENT_NAME, 'wiredFieldValue', 'Received field value.');
            if (data.success) {
                this.formulaValue         = data.data || '';
                this.originalFormulaValue = this.formulaValue;
                this.verifyResult         = null;
            } else {
                promptWarning(this, data.message || 'Unable to retrieve formula value.');
            }
        } else if (error) {
            promptError(this, getErrorMessage(error));
        }
    }

    // ── Wire: getCustomMetadataTypes ──────────────────────────────────────────

    @wire(getCustomMetadataTypes, { cacheIdx: '$cacheIdx' })
    wiredMetadataTypes({ error, data }) {
        if (data) {
            if (data.success && data.data) {
                this.metadataTypeOptions = [
                    { label: '-- Select Metadata Type --', value: '' },
                    ...data.data.map(name => ({ label: name, value: name }))
                ];
            }
        } else if (error) {
            promptError(this, getErrorMessage(error));
        }
    }

    // ── Computed properties ───────────────────────────────────────────────────

    get isLoading() {
        return this.spinnerCount > 0;
    }

    get isDirty() {
        return this.formulaValue !== this.originalFormulaValue;
    }

    get operatorTokens() {
        return OPERATOR_TOKENS;
    }

    get hasVerifyResult() {
        return this.verifyResult !== null;
    }

    get verifyIsValid() {
        return this.verifyResult && this.verifyResult.isValid === true;
    }

    get verifyStatusClass() {
        return this.verifyIsValid
            ? 'formula-builder-verify-status formula-builder-verify-valid'
            : 'formula-builder-verify-status formula-builder-verify-invalid';
    }

    get verifyStatusIcon() {
        return this.verifyIsValid ? 'utility:success' : 'utility:error';
    }

    get verifyStatusMessage() {
        return this.verifyIsValid
            ? LABEL_VERIFY_SUCCESS
            : (this.verifyResult && this.verifyResult.errorMessage) || 'Syntax error detected.';
    }

    get saveDisabled() {
        return !this.isDirty || this.isLoading;
    }

    get verifyDisabled() {
        return !this.formulaValue || this.isLoading;
    }

    get hasMetadataTypes() {
        return this.metadataTypeOptions.length > 1;
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    /**
     * @description Tracks cursor position within the formula textarea for accurate insertion
     * @param {Event} event - click or keyup event from the textarea
     */
    handleCursorMove(event) {
        this._cursorPosition = event.target.selectionStart || this.formulaValue.length;
    }

    /**
     * @description Updates the tracked formula value as the user types
     * @param {CustomEvent} event - change event from lightning-textarea
     */
    handleFormulaChange(event) {
        this.formulaValue = event.target.value;
        this.verifyResult = null;
        this._cursorPosition = event.target.selectionStart || this.formulaValue.length;
        logInfo(COMPONENT_NAME, 'handleFormulaChange', 'Formula updated by user input.');
    }

    /**
     * @description Inserts an operator token at the current cursor position
     * @param {CustomEvent} event - click event from an operator button
     */
    handleOperatorInsert(event) {
        const token    = event.currentTarget.dataset.token;
        const before   = this.formulaValue.slice(0, this._cursorPosition);
        const after    = this.formulaValue.slice(this._cursorPosition);
        this.formulaValue    = before + token + after;
        this._cursorPosition = before.length + token.length;
        this.verifyResult    = null;
        logInfo(COMPONENT_NAME, 'handleOperatorInsert', 'Inserted operator: ' + token);
    }

    /**
     * @description Handles selection of a Custom Metadata type and appends it to the formula
     * @param {CustomEvent} event - change event from the metadata type combobox
     */
    handleMetadataTypeChange(event) {
        const selected = event.detail.value;
        this.selectedMetadataType = selected;
        if (selected) {
            const token            = selected + '.';
            const before           = this.formulaValue.slice(0, this._cursorPosition);
            const after            = this.formulaValue.slice(this._cursorPosition);
            this.formulaValue      = before + token + after;
            this._cursorPosition   = before.length + token.length;
            this.verifyResult      = null;
            this.selectedMetadataType = '';
            logInfo(COMPONENT_NAME, 'handleMetadataTypeChange', 'Inserted metadata type reference: ' + token);
        }
    }

    /**
     * @description Clears the formula editor
     */
    handleClear() {
        this.formulaValue    = '';
        this._cursorPosition = 0;
        this.verifyResult    = null;
        logInfo(COMPONENT_NAME, 'handleClear', 'Formula cleared.');
    }

    /**
     * @description Resets the formula to the last saved value, discarding unsaved edits
     */
    handleReset() {
        this.formulaValue    = this.originalFormulaValue;
        this._cursorPosition = this.formulaValue.length;
        this.verifyResult    = null;
        logInfo(COMPONENT_NAME, 'handleReset', 'Formula reset to original value.');
    }

    /**
     * @description Calls the Apex verifyFormula method to validate the current formula syntax
     */
    async handleVerify() {
        if (!this.formulaValue) {
            promptWarning(this, 'Please enter a formula before verifying.');
            return;
        }
        if (!this.recordId) {
            promptWarning(this, LABEL_NO_RECORD);
            return;
        }
        this.toggleSpinner(1);
        try {
            const response = await verifyFormula({
                formula       : this.formulaValue,
                objectApiName : this.objectApiName,
                recordId      : this.recordId
            });
            if (response && response.success) {
                this.verifyResult = response.data;
                if (!this.verifyResult.isValid) {
                    promptWarning(this, this.verifyResult.errorMessage || 'Syntax error detected.');
                }
            } else {
                promptError(this, (response && response.message) || 'Verification failed.');
            }
        } catch (error) {
            promptError(this, getErrorMessage(error));
        } finally {
            this.toggleSpinner(-1);
        }
    }

    /**
     * @description Persists the current formula value to the record via Apex
     */
    async handleSave() {
        if (!this.recordId) {
            promptWarning(this, LABEL_NO_RECORD);
            return;
        }
        if (!this.isDirty) {
            promptWarning(this, 'No changes to save.');
            return;
        }
        this.toggleSpinner(1);
        try {
            const response = await updateFieldValue({
                objectApiName : this.objectApiName,
                fieldApiName  : this.fieldApiName,
                recordId      : this.recordId,
                formulaValue  : this.formulaValue
            });
            if (response && response.success) {
                this.originalFormulaValue = this.formulaValue;
                this.verifyResult         = null;
                promptSuccess(this, LABEL_SAVE_SUCCESS);
                logInfo(COMPONENT_NAME, 'handleSave', 'Formula saved successfully.');
                this.dispatchEvent(new CustomEvent('formulasaved', {
                    detail  : { formulaValue: this.formulaValue },
                    bubbles : true,
                    composed: true
                }));
            } else {
                promptError(this, (response && response.message) || 'Save failed.');
            }
        } catch (error) {
            promptError(this, getErrorMessage(error));
        } finally {
            this.toggleSpinner(-1);
        }
    }

    /**
     * @description Fired by the parent or refresh framework to force a wire re-fetch
     */
    handleRefresh() {
        this.cacheIdx = initCacheIdx();
        logInfo(COMPONENT_NAME, 'handleRefresh', 'Refresh triggered — cacheIdx updated.');
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * @description Increments or decrements the spinner counter to show/hide the loading state
     * @param {Number} delta  Pass 1 to show, -1 to hide
     */
    toggleSpinner(delta) {
        this.spinnerCount = Math.max(0, this.spinnerCount + delta);
    }
}
