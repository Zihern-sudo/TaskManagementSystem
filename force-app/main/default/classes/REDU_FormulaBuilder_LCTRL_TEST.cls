/**
 * @Author      WDCi ()
 * @Date        April 2026
 * @group       Formula Builder
 * @Description Test class for REDU_FormulaBuilder_LCTRL
 * @changehistory
 * ISS-002768 2026-04-03 WDCi - Initial test class for Formula Builder Apex Controller
 */
@isTest
public class REDU_FormulaBuilder_LCTRL_TEST {

    // ── Constants ──────────────────────────────────────────────────────────────
    private static final String OBJECT_API_NAME = 'Account';
    private static final String FIELD_API_NAME  = 'Description';

    // ── Test Data Setup ────────────────────────────────────────────────────────

    @TestSetup
    static void makeData() {
        Account testAccount = new Account(
            Name        = 'Formula Builder Test Account',
            Description = 'Field1__c != null && Field2__c > 0'
        );
        insert testAccount;
    }

    // ── Helper ─────────────────────────────────────────────────────────────────

    private static Account getTestAccount() {
        return [SELECT Id, Description FROM Account WHERE Name = 'Formula Builder Test Account' LIMIT 1];
    }

    // ── getFieldValue ──────────────────────────────────────────────────────────

    @isTest
    static void testGetFieldValue_Success() {
        Account acct = getTestAccount();

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.getFieldValue(
            OBJECT_API_NAME,
            FIELD_API_NAME,
            acct.Id
        );
        Test.stopTest();

        System.assertNotEquals(null, response,          'Response should not be null');
        System.assertEquals(true,   response.success,   'Response should indicate success');
        System.assertNotEquals(null, response.data,     'Response data should contain the field value');
        System.assertEquals(
            'Field1__c != null && Field2__c > 0',
            (String) response.data,
            'Returned field value should match the Description set in makeData'
        );
    }

    @isTest
    static void testGetFieldValue_RecordNotFound() {
        // Use a fabricated but syntactically valid Id for a non-existent record
        Id fakeId = '001000000000001AAA';

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.getFieldValue(
            OBJECT_API_NAME,
            FIELD_API_NAME,
            fakeId
        );
        Test.stopTest();

        System.assertNotEquals(null, response,          'Response should not be null');
        System.assertEquals(false,  response.success,   'Response should indicate failure for missing record');
    }

    // ── updateFieldValue ───────────────────────────────────────────────────────

    @isTest
    static void testUpdateFieldValue_Success() {
        Account acct            = getTestAccount();
        String  newFormulaValue = 'Field3__c == true || Field4__c != null';

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.updateFieldValue(
            OBJECT_API_NAME,
            FIELD_API_NAME,
            acct.Id,
            newFormulaValue
        );
        Test.stopTest();

        System.assertNotEquals(null, response,        'Response should not be null');
        System.assertEquals(true,   response.success, 'Response should indicate success');

        Account updated = [SELECT Description FROM Account WHERE Id = :acct.Id];
        System.assertEquals(newFormulaValue, updated.Description, 'Description field should be updated with new formula');
    }

    // ── getCustomMetadataTypes ─────────────────────────────────────────────────

    @isTest
    static void testGetCustomMetadataTypes_Success() {
        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.getCustomMetadataTypes();
        Test.stopTest();

        System.assertNotEquals(null, response,        'Response should not be null');
        System.assertEquals(true,   response.success, 'Response should indicate success');
        System.assertNotEquals(null, response.data,   'Response data should contain metadata type names');

        List<Object> typeNames = (List<Object>) response.data;
        System.assert(!typeNames.isEmpty(), 'Should return at least one Custom Metadata type from the org');
        for (Object typeName : typeNames) {
            System.assert(
                ((String) typeName).endsWith('__mdt'),
                'Each entry should end with __mdt but got: ' + typeName
            );
        }
    }

    // ── verifyFormula – valid syntax ───────────────────────────────────────────

    @isTest
    static void testVerifyFormula_ValidSyntax() {
        Account acct    = getTestAccount();
        String  formula = 'Field1__c != null && Field2__c > 0';

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.verifyFormula(
            formula,
            OBJECT_API_NAME,
            acct.Id
        );
        Test.stopTest();

        System.assertNotEquals(null, response,        'Response should not be null');
        System.assertEquals(true,   response.success, 'Outer response should succeed');

        Map<String, Object> result = (Map<String, Object>) response.data;
        System.assertEquals(true, (Boolean) result.get('isValid'), 'Formula should be marked as valid');
        System.assertEquals(null, result.get('errorMessage'),      'No error message expected for a valid formula');
    }

    @isTest
    static void testVerifyFormula_ValidComplexSyntax() {
        Account acct    = getTestAccount();
        String  formula = '(Field1__c != null && Field2__c > 0) || (Field3__c == \'Active\' && Field4__c >= 5)';

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.verifyFormula(
            formula,
            OBJECT_API_NAME,
            acct.Id
        );
        Test.stopTest();

        Map<String, Object> result = (Map<String, Object>) response.data;
        System.assertEquals(true, (Boolean) result.get('isValid'), 'Complex valid formula should pass verification');
    }

    // ── verifyFormula – invalid syntax ─────────────────────────────────────────

    @isTest
    static void testVerifyFormula_InvalidSyntax_UnmatchedOpenParen() {
        Account acct    = getTestAccount();
        String  formula = '(Field1__c != null && Field2__c > 0';

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.verifyFormula(
            formula,
            OBJECT_API_NAME,
            acct.Id
        );
        Test.stopTest();

        Map<String, Object> result = (Map<String, Object>) response.data;
        System.assertEquals(false, (Boolean) result.get('isValid'),     'Unmatched open paren should be invalid');
        System.assertNotEquals(null, result.get('errorMessage'),         'Error message should be provided');
    }

    @isTest
    static void testVerifyFormula_InvalidSyntax_UnmatchedCloseParen() {
        Account acct    = getTestAccount();
        String  formula = 'Field1__c != null) && Field2__c > 0';

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.verifyFormula(
            formula,
            OBJECT_API_NAME,
            acct.Id
        );
        Test.stopTest();

        Map<String, Object> result = (Map<String, Object>) response.data;
        System.assertEquals(false, (Boolean) result.get('isValid'), 'Unmatched close paren should be invalid');
        System.assertNotEquals(null, result.get('errorMessage'),    'Error message should be provided');
    }

    @isTest
    static void testVerifyFormula_InvalidSyntax_DuplicateOperator() {
        Account acct    = getTestAccount();
        String  formula = 'Field1__c != null && && Field2__c > 0';

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.verifyFormula(
            formula,
            OBJECT_API_NAME,
            acct.Id
        );
        Test.stopTest();

        Map<String, Object> result = (Map<String, Object>) response.data;
        System.assertEquals(false, (Boolean) result.get('isValid'), 'Duplicate operator should be invalid');
        System.assertNotEquals(null, result.get('errorMessage'),    'Error message should be provided');
    }

    @isTest
    static void testVerifyFormula_InvalidSyntax_EmptyFormula() {
        Account acct = getTestAccount();

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.verifyFormula(
            '',
            OBJECT_API_NAME,
            acct.Id
        );
        Test.stopTest();

        Map<String, Object> result = (Map<String, Object>) response.data;
        System.assertEquals(false, (Boolean) result.get('isValid'), 'Empty formula should be invalid');
        System.assertNotEquals(null, result.get('errorMessage'),    'Error message should indicate empty formula');
    }

    @isTest
    static void testVerifyFormula_InvalidSyntax_DanglingOperator() {
        Account acct    = getTestAccount();
        String  formula = 'Field1__c != null &&';

        Test.startTest();
        REDU_LightningResponse response = REDU_FormulaBuilder_LCTRL.verifyFormula(
            formula,
            OBJECT_API_NAME,
            acct.Id
        );
        Test.stopTest();

        Map<String, Object> result = (Map<String, Object>) response.data;
        System.assertEquals(false, (Boolean) result.get('isValid'), 'Trailing operator should be invalid');
        System.assertNotEquals(null, result.get('errorMessage'),    'Error message should be provided');
    }
}
