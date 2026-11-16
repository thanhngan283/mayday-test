async function assertTestDatabase({ expectedDatabaseName }) {
    // Inspect the adapter's actual DB connection; never trust the caller's environment variable alone.
    throw new Error(`Implement test database verification for ${expectedDatabaseName}.`);
}

async function getRoleIds({ expectedDatabaseName }) {
    throw new Error(`Implement role lookup for ${expectedDatabaseName}.`);
}

async function promoteUser({ phone, roleId, expectedDatabaseName }) {
    throw new Error(`Implement safe test-user promotion for ${phone} in ${expectedDatabaseName} (role ${roleId}).`);
}

async function deleteUser({ phone, expectedDatabaseName }) {
    throw new Error(`Implement idempotent cleanup for the suite-created account ${phone} in ${expectedDatabaseName}.`);
}

async function deleteTestRole({ name, expectedDatabaseName }) {
    throw new Error(`Implement idempotent cleanup for test role ${name} in ${expectedDatabaseName}.`);
}

async function softDeleteUser({ phone, expectedDatabaseName }) {
    throw new Error(`Implement soft-delete setup for ${phone} in ${expectedDatabaseName}.`);
}

async function setUserActive({ phone, isActive, expectedDatabaseName }) {
    throw new Error(`Implement test-user active-state setup for ${phone} in ${expectedDatabaseName} (${isActive}).`);
}

async function getOtp({ phone, expectedDatabaseName }) {
    throw new Error(`Implement OTP retrieval through the backend's test hook for ${phone} in ${expectedDatabaseName}.`);
}

async function setOtpServiceFailure({ enabled, expectedDatabaseName }) {
    throw new Error(`Implement OTP provider failure test hook in ${expectedDatabaseName} (enabled: ${enabled}).`);
}

async function advanceTestClock({ milliseconds, expectedDatabaseName }) {
    throw new Error(`Implement a test-only clock hook in ${expectedDatabaseName} (${milliseconds}ms).`);
}

async function getExpiredToken({ phone, expectedDatabaseName }) {
    throw new Error(`Implement an expired token test fixture for ${phone} in ${expectedDatabaseName}.`);
}

async function prepareStaffFixture({ expectedDatabaseName }) {
    throw new Error(`Implement isolated branch/department/room fixtures in ${expectedDatabaseName}.`);
}

async function cleanupTestFixtures({ expectedDatabaseName }) {
    throw new Error(`Implement exact fixture cleanup in ${expectedDatabaseName}.`);
}

async function prepareUserWithLinkedData({ phone, expectedDatabaseName }) {
    throw new Error(`Implement a disposable linked-data fixture for ${phone} in ${expectedDatabaseName}.`);
}

async function prepareBranchDependencies({ branchId, withStaff, expectedDatabaseName }) {
    throw new Error(`Implement disposable department/staff dependencies for branch ${branchId} in ${expectedDatabaseName} (staff: ${withStaff}).`);
}

async function cleanupWeek3Resources({ permissionIds, branchIds, roleIds, expectedDatabaseName }) {
    throw new Error(`Implement exact Week 3 permission/branch/role cleanup in ${expectedDatabaseName}: ${permissionIds.length} permissions, ${branchIds.length} branches, ${roleIds.length} roles.`);
}

async function restoreRolePermission({ roleId, permissionId, expectedDatabaseName }) {
    throw new Error(`Implement idempotent restoration of role ${roleId} permission ${permissionId} in ${expectedDatabaseName}.`);
}

async function prepareWeek4OrganizationDependency({
    kind, departmentId, roomId, codeTemplate, expectedDatabaseName
}) {
    throw new Error(`Implement disposable Week 4 "${kind}" dependency fixture in ${expectedDatabaseName} (department ${departmentId}, room ${roomId}, template ${codeTemplate}).`);
}

async function cleanupWeek4OrganizationDependencies({ fixtureIds, expectedDatabaseName }) {
    throw new Error(`Implement exact Week 4 dependency cleanup in ${expectedDatabaseName} for ${fixtureIds.length} suite-owned fixtures.`);
}

async function prepareWeek5TemplateUsage({ codeTemplate, expectedDatabaseName }) {
    throw new Error(`Implement a disposable record using template ${codeTemplate} in ${expectedDatabaseName} and return its opaque fixture IDs.`);
}

async function cleanupWeek5Fixtures({ fixtureIds, expectedDatabaseName }) {
    throw new Error(`Implement exact Week 5 fixture cleanup in ${expectedDatabaseName} for ${fixtureIds.length} suite-owned fixtures.`);
}

async function prepareWeek6Fixtures({ uniquePrefix, expectedDatabaseName }) {
    throw new Error(`Implement isolated Week 6 screening/template fixtures in ${expectedDatabaseName} using prefix ${uniquePrefix}; do not create accounts.`);
}

async function prepareWeek6MedicalRecord({
    uniquePrefix, patientId, templateId, status, assignedDoctorId, createdBy, expectedDatabaseName
}) {
    throw new Error(`Implement isolated Week 6 record fixture in ${expectedDatabaseName} (${uniquePrefix}, patient ${patientId}, template ${templateId}, status ${status}, doctor ${assignedDoctorId}, creator ${createdBy}).`);
}

async function cleanupWeek6Fixtures({
    fixtureIds, medicalRecordIds, patientIds, expectedDatabaseName
}) {
    throw new Error(`Implement exact Week 6 cleanup in ${expectedDatabaseName} for ${fixtureIds.length} fixture IDs, ${medicalRecordIds.length} API-created records, and ${patientIds.length} suite patients.`);
}

async function prepareWeek7Fixtures({ uniquePrefix, expectedDatabaseName }) {
    throw new Error(`Implement isolated Week 7 template/question/option fixtures in ${expectedDatabaseName} using prefix ${uniquePrefix}; do not create accounts or records.`);
}

async function prepareWeek7MedicalRecord({
    uniquePrefix, patientId, templateId, status, assignedDoctorId, expectedDatabaseName
}) {
    throw new Error(`Implement a fresh Week 7 medical-record fixture in ${expectedDatabaseName} (${uniquePrefix}, patient ${patientId}, template ${templateId}, status ${status}, doctor ${assignedDoctorId}).`);
}

async function cleanupWeek7Fixtures({ fixtureIds, expectedDatabaseName }) {
    throw new Error(`Implement exact, idempotent Week 7 fixture cleanup in ${expectedDatabaseName} for ${fixtureIds.length} suite-owned fixtures.`);
}

async function prepareWeek8LesionPhoto({
    uniquePrefix, patientId, medicalRecordId, episodeId, locationId, expectedDatabaseName
}) {
    throw new Error(`Implement an isolated Week 8 photo fixture in ${expectedDatabaseName} (${uniquePrefix}, patient ${patientId}, record ${medicalRecordId}, episode ${episodeId}, location ${locationId}).`);
}

async function cleanupWeek8Fixtures({ fixtureIds, expectedDatabaseName }) {
    throw new Error(`Implement exact, idempotent Week 8 fixture cleanup in ${expectedDatabaseName} for ${fixtureIds.length} suite-owned fixtures.`);
}

async function setMinioFailure({ enabled, expectedDatabaseName }) {
    throw new Error(`Implement the test-only MinIO failure hook in ${expectedDatabaseName} (enabled: ${enabled}).`);
}

async function resetTestHooks({ expectedDatabaseName }) {
    throw new Error(`Implement OTP/clock hook restoration in ${expectedDatabaseName}.`);
}

module.exports = {
    assertTestDatabase,
    getRoleIds,
    promoteUser,
    deleteUser,
    deleteTestRole,
    softDeleteUser,
    setUserActive,
    getOtp,
    setOtpServiceFailure,
    advanceTestClock,
    getExpiredToken,
    prepareStaffFixture,
    prepareUserWithLinkedData,
    prepareBranchDependencies,
    cleanupWeek3Resources,
    restoreRolePermission,
    prepareWeek4OrganizationDependency,
    cleanupWeek4OrganizationDependencies,
    prepareWeek5TemplateUsage,
    cleanupWeek5Fixtures,
    prepareWeek6Fixtures,
    prepareWeek6MedicalRecord,
    cleanupWeek6Fixtures,
    prepareWeek7Fixtures,
    prepareWeek7MedicalRecord,
    cleanupWeek7Fixtures,
    prepareWeek8LesionPhoto,
    cleanupWeek8Fixtures,
    setMinioFailure,
    cleanupTestFixtures,
    resetTestHooks
};
