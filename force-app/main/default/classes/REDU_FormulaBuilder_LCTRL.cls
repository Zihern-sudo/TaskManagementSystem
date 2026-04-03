/**
 * @Author      WDCi ()
 * @Date        April 2026
 * @group       Formula Builder
 * @Description Apex controller for the formulaBuilder LWC. Handles field value
 *              retrieval, formula updates, custom metadata type lookups, and
 *              formula syntax verification.
 * @changehistory
 * ISS-002768 2026-04-03 WDCi - Initial development of Formula Builder Apex Controller
 */
public with sharing class REDU_FormulaBuilder_LCTRL {

    /**
     * @description Retrieves the current formula value of a specified field on a given record
     * @param objectApiName API name of the Salesforce object (e.g. Study_Requirement_Set__c)
     * @param fieldApiName  API name of the formula field to retrieve (e.g. Criteria__c)
     * @param recordId      The Salesforce record Id to retrieve the field value from
     * @return REDU_LightningResponse containing the field value as a String
     */
    @AuraEnabled(cacheable=true)
    public static REDU_LightningResponse getFieldValue(String objectApiName, String fieldApiName, Id recordId) {
        try {
            String safeObject = String.escapeSingleQuotes(objectApiName);
            String safeField  = String.escapeSingleQuotes(fieldApiName);
            String query = 'SELECT ' + safeField + ' FROM ' + safeObject
                         + ' WHERE Id = :recordId WITH SECURITY_ENFORCED LIMIT 1';
            List<SObject> records = Database.query(query);
            if (records.isEmpty()) {
                return new REDU_LightningResponse(false, null, 'Record not found for Id: ' + recordId);
            }
            Object fieldValue = records[0].get(fieldApiName);
            return new REDU_LightningResponse(true, String.valueOf(fieldValue != null ? fieldValue : ''), null);
        } catch (QueryException qex) {
            String errorMsg = REDU_ObjectSecurity_UTIL.handleQueryException(qex, false);
            throw REDU_Exception_UTIL.auraException(errorMsg);
        } catch (Exception exp) {
            throw REDU_Exception_UTIL.auraException(exp.getMessage(), exp.getLineNumber(), null);
        }
    }

    /**
     * @description Updates a specified field on a given record with the new formula string
     * @param objectApiName API name of the Salesforce object
     * @param fieldApiName  API name of the field to update
     * @param recordId      The Salesforce record Id to update
     * @param formulaValue  The new formula string to save to the field
     * @return REDU_LightningResponse confirming the update
     */
    @AuraEnabled
    public static REDU_LightningResponse updateFieldValue(String objectApiName, String fieldApiName, Id recordId, String formulaValue) {
        try {
            SObject sobj = Schema.getGlobalDescribe().get(objectApiName).newSObject();
            sobj.put('Id', recordId);
            sobj.put(fieldApiName, formulaValue);
            update sobj;
            return new REDU_LightningResponse(true, null, 'Formula saved successfully.');
        } catch (QueryException qex) {
            String errorMsg = REDU_ObjectSecurity_UTIL.handleQueryException(qex, false);
            throw REDU_Exception_UTIL.auraException(errorMsg);
        } catch (Exception exp) {
            throw REDU_Exception_UTIL.auraException(exp.getMessage(), exp.getLineNumber(), null);
        }
    }

    /**
     * @description Retrieves all available Custom Metadata types from the org
     *              by querying EntityDefinition for types ending in '__mdt'
     * @return REDU_LightningResponse containing a List<String> of CustomMetadata type API names
     */
    @AuraEnabled(cacheable=true)
    public static REDU_LightningResponse getCustomMetadataTypes() {
        try {
            List<EntityDefinition> entities = [
                SELECT QualifiedApiName
                FROM   EntityDefinition
                WHERE  QualifiedApiName LIKE '%__mdt'
                ORDER BY QualifiedApiName ASC
            ];
            List<String> typeNames = new List<String>();
            for (EntityDefinition ed : entities) {
                typeNames.add(ed.QualifiedApiName);
            }
            return new REDU_LightningResponse(true, typeNames, null);
        } catch (QueryException qex) {
            String errorMsg = REDU_ObjectSecurity_UTIL.handleQueryException(qex, false);
            throw REDU_Exception_UTIL.auraException(errorMsg);
        } catch (Exception exp) {
            throw REDU_Exception_UTIL.auraException(exp.getMessage(), exp.getLineNumber(), null);
        }
    }

    /**
     * @description Validates the syntax of a formula string against a sample record.
     *              Checks for missing commas, unmatched parentheses, and invalid operators.
     *              Does NOT evaluate whether the logical output is true or false.
     * @param formula       The formula string to verify
     * @param objectApiName API name of the object the formula belongs to
     * @param recordId      A sample record Id to use for context during verification
     * @return REDU_LightningResponse containing isValid (Boolean) and errorMessage (String)
     */
    @AuraEnabled
    public static REDU_LightningResponse verifyFormula(String formula, String objectApiName, Id recordId) {
        try {
            if (String.isBlank(formula)) {
                Map<String, Object> emptyResult = new Map<String, Object>{
                    'isValid'      => false,
                    'errorMessage' => 'Formula cannot be empty.'
                };
                return new REDU_LightningResponse(true, emptyResult, null);
            }

            // ── 1. Balanced parentheses ─────────────────────────────────────
            Integer parenDepth = 0;
            for (Integer i = 0; i < formula.length(); i++) {
                String ch = formula.substring(i, i + 1);
                if (ch == '(') {
                    parenDepth++;
                } else if (ch == ')') {
                    parenDepth--;
                    if (parenDepth < 0) {
                        Map<String, Object> result = new Map<String, Object>{
                            'isValid'      => false,
                            'errorMessage' => 'Unmatched closing parenthesis at position ' + (i + 1) + '.'
                        };
                        return new REDU_LightningResponse(true, result, null);
                    }
                }
            }
            if (parenDepth != 0) {
                Map<String, Object> result = new Map<String, Object>{
                    'isValid'      => false,
                    'errorMessage' => 'Unmatched opening parenthesis: ' + parenDepth + ' unclosed parenthesis(es).'
                };
                return new REDU_LightningResponse(true, result, null);
            }

            // ── 2. Empty parentheses ────────────────────────────────────────
            Pattern emptyParens = Pattern.compile('\\(\\s*\\)');
            Matcher m1 = emptyParens.matcher(formula);
            if (m1.find()) {
                Map<String, Object> result = new Map<String, Object>{
                    'isValid'      => false,
                    'errorMessage' => 'Empty parentheses detected. Function calls require at least one argument.'
                };
                return new REDU_LightningResponse(true, result, null);
            }

            // ── 3. Duplicate / invalid logical operators ────────────────────
            Pattern dupOps = Pattern.compile('(&&\\s*&&|\\|\\|\\s*\\|\\||==\\s*==|!=\\s*!=|>>|<<)');
            Matcher m2 = dupOps.matcher(formula);
            if (m2.find()) {
                Map<String, Object> result = new Map<String, Object>{
                    'isValid'      => false,
                    'errorMessage' => 'Invalid operator sequence detected near: "' + m2.group() + '".'
                };
                return new REDU_LightningResponse(true, result, null);
            }

            // ── 4. Dangling binary operators at start / end ─────────────────
            Pattern danglingOp = Pattern.compile('(?i)^\\s*(&&|\\|\\||AND\\b|OR\\b)|( &&|\\|\\||\\bAND\\b|\\bOR\\b)\\s*$');
            Matcher m3 = danglingOp.matcher(formula.trim());
            if (m3.find()) {
                Map<String, Object> result = new Map<String, Object>{
                    'isValid'      => false,
                    'errorMessage' => 'Formula starts or ends with a logical operator, which is invalid.'
                };
                return new REDU_LightningResponse(true, result, null);
            }

            // ── 5. Missing comma inside function calls  ─────────────────────
            // Detects two quoted/unquoted tokens adjacent without a comma, e.g. INCLUDES(Field__c 'Value')
            Pattern missingComma = Pattern.compile('([\\w\\.]+|\'[^\']*\')\\s+([\\w\\.]+|\'[^\']*\')(?!\\s*[,\\)])');
            Matcher m4 = missingComma.matcher(formula);
            if (m4.find()) {
                // Only flag when inside parentheses (rough heuristic: check surrounding context)
                String surrounding = formula.substring(Math.max(0, m4.start() - 10), Math.min(formula.length(), m4.end() + 10));
                if (surrounding.contains('(')) {
                    Map<String, Object> result = new Map<String, Object>{
                        'isValid'      => false,
                        'errorMessage' => 'Possible missing comma in function arguments near: "' + m4.group() + '".'
                    };
                    return new REDU_LightningResponse(true, result, null);
                }
            }

            // ── All checks passed ───────────────────────────────────────────
            Map<String, Object> validResult = new Map<String, Object>{
                'isValid'      => true,
                'errorMessage' => null
            };
            return new REDU_LightningResponse(true, validResult, null);

        } catch (QueryException qex) {
            String errorMsg = REDU_ObjectSecurity_UTIL.handleQueryException(qex, false);
            throw REDU_Exception_UTIL.auraException(errorMsg);
        } catch (Exception exp) {
            throw REDU_Exception_UTIL.auraException(exp.getMessage(), exp.getLineNumber(), null);
        }
    }
}
