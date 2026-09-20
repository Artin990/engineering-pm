/**
 * Comprehensive dual-role audit script for all project tabs & Super Admin
 */
import assert from "node:assert";

const BASE_URL = "http://localhost:3000";

const CEO_COOKIES = [
  "flowdeck_active_role=admin",
  "flowdeck_user_email=amiriartin185%40gmail.com",
  "flowdeck_user_name=Artin%20Amiri",
].join("; ");

const MEMBER_COOKIES = [
  "flowdeck_active_role=member",
  "flowdeck_user_email=subordinate.employee%40company.com",
  "flowdeck_user_name=Mohammad%20Rezaei",
].join("; ");

const TABS = [
  "",
  "/issues",
  "/roadmap",
  "/milestones",
  "/cycles",
  "/members",
  "/analytics",
  "/activity",
  "/github",
  "/settings",
];

async function runAudit() {
  console.log("=================================================");
  console.log("🚀 STARTING DUAL-ROLE TAB & SYSTEM AUDIT (PM)");
  console.log("=================================================");

  let passCount = 0;
  let totalCount = 0;

  // 1. Audit each project tab as CEO
  console.log("\n[1] Testing 10 Project Tabs as CEO (Admin)...");
  for (const tab of TABS) {
    totalCount++;
    const url = `${BASE_URL}/projects/PM${tab}`;
    const res = await fetch(url, { headers: { Cookie: CEO_COOKIES } });
    if (res.status === 200) {
      console.log(`  ✓ CEO [200 OK]: /projects/PM${tab || " (Overview)"}`);
      passCount++;
    } else {
      console.error(`  ✗ CEO FAILED [${res.status}]: /projects/PM${tab}`);
    }
  }

  // 2. Audit each project tab as Subordinate Employee (Member)
  console.log("\n[2] Testing 10 Project Tabs as Subordinate Employee (Member)...");
  for (const tab of TABS) {
    totalCount++;
    const url = `${BASE_URL}/projects/PM${tab}`;
    const res = await fetch(url, { headers: { Cookie: MEMBER_COOKIES } });
    if (res.status === 200) {
      console.log(`  ✓ Member [200 OK]: /projects/PM${tab || " (Overview)"}`);
      passCount++;
    } else {
      console.error(`  ✗ Member FAILED [${res.status}]: /projects/PM${tab}`);
    }
  }

  // 3. Audit Super Admin Panel at /rc-admin
  console.log("\n[3] Testing Super Admin Control Tower (/rc-admin)...");
  totalCount++;
  const adminPageRes = await fetch(`${BASE_URL}/rc-admin`, {
    headers: { Cookie: CEO_COOKIES },
  });
  if (adminPageRes.status === 200) {
    console.log("  ✓ Super Admin UI [200 OK]: /rc-admin");
    passCount++;
  } else {
    console.error(`  ✗ Super Admin UI FAILED [${adminPageRes.status}]`);
  }

  // 4. Test Super Admin API with passkey
  totalCount++;
  const adminApiRes = await fetch(`${BASE_URL}/api/v1/admin`, {
    headers: { "x-rc-admin-key": "RC-SUPERADMIN-2026" },
  });
  const adminApiJson = await adminApiRes.json();
  if (adminApiRes.status === 200 && adminApiJson.success) {
    console.log(`  ✓ Super Admin API [200 OK]: Workspaces=${adminApiJson.data.workspaces.length}, Projects=${adminApiJson.data.projects.length}, Users=${adminApiJson.data.users.length}`);
    passCount++;
  } else {
    console.error(`  ✗ Super Admin API FAILED [${adminApiRes.status}]`, adminApiJson);
  }

  // 5. Test Issue Persistence & Cross-User Visibility in Project Sync
  console.log("\n[4] Testing Issue Creation & Cross-Role Visibility Sync...");
  const newTestIssueId = "d1111111-2222-4444-8888-999999999999";
  const testIssuePayload = {
    issues: [
      {
        id: newTestIssueId,
        key: "PM-999",
        title: "ایشوی تست یکپارچه‌سازی و دسترسی اعضای زیرمجموعه",
        description: "این تسک باید بلافاصله توسط کارکنان زیرمجموعه قابل مشاهده باشد",
        status: "in_progress",
        priority: "high",
        type: "feature",
        estimate: 5,
        assignee: {
          id: "mem-subordinate",
          displayName: "Mohammad Rezaei",
          email: "subordinate.employee@company.com",
        },
      },
    ],
  };

  totalCount++;
  const syncPostRes = await fetch(`${BASE_URL}/api/v1/projects/PM/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: CEO_COOKIES },
    body: JSON.stringify(testIssuePayload),
  });
  const syncPostJson = await syncPostRes.json();
  if (syncPostRes.status === 200 && syncPostJson.success) {
    console.log("  ✓ CEO Created & Synced Issue to DB: PM-999");
    passCount++;
  } else {
    console.error(`  ✗ Sync POST failed [${syncPostRes.status}]`);
  }

  // Now Subordinate Employee fetches the project sync
  totalCount++;
  const memberSyncGetRes = await fetch(`${BASE_URL}/api/v1/projects/PM/sync`, {
    headers: { Cookie: MEMBER_COOKIES },
  });
  const memberSyncJson = await memberSyncGetRes.json();
  const foundIssue = memberSyncJson.data?.issues?.find((i) => i.key === "PM-999" || i.id === newTestIssueId);

  if (memberSyncGetRes.status === 200 && foundIssue) {
    console.log(`  ✓ Subordinate Employee can see issue: "${foundIssue.title}" (Status: ${foundIssue.status})`);
    passCount++;
  } else {
    console.error("  ✗ Subordinate Employee could not see newly added issue!");
  }

  // 6. Test Registration Links
  console.log("\n[5] Testing CEO Registration Route...");
  totalCount++;
  const registerCeoRes = await fetch(`${BASE_URL}/register?role=ceo`);
  if (registerCeoRes.status === 200) {
    console.log("  ✓ CEO Register Page [200 OK]: /register?role=ceo");
    passCount++;
  } else {
    console.error(`  ✗ CEO Register Page failed [${registerCeoRes.status}]`);
  }

  console.log("\n=================================================");
  console.log(`🎯 AUDIT COMPLETED: ${passCount} / ${totalCount} PASSED (${Math.round((passCount / totalCount) * 100)}%)`);
  console.log("=================================================");

  if (passCount === totalCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAudit().catch((e) => {
  console.error("Fatal audit error:", e);
  process.exit(1);
});
