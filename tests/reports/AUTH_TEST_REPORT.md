# Authentication & Security QA Test & Defect Report

**Project:** PulseCare Smart Healthcare Appointment System  
**Module:** Authentication, Token Lifecycle, Password Reset, RBAC & Defensive Vulnerability Suite  
**Date of Execution:** November 19, 2026  
**Environment:** Java 21 / Spring Boot 3.3.5 / Spring Security 6 / MockMvc / H2 Test Context  
**Test Suites:**
- Passing Baseline Suite: [`apps/backend/src/test/java/com/group6/healthcare/auth/ComprehensiveAuthSecurityTest.java`](file:///apps/backend/src/test/java/com/group6/healthcare/auth/ComprehensiveAuthSecurityTest.java)
- Failing Defect Suite: [`apps/backend/src/test/java/com/group6/healthcare/auth/AuthDefectsAndEdgeCasesTest.java`](file:///apps/backend/src/test/java/com/group6/healthcare/auth/AuthDefectsAndEdgeCasesTest.java)  
**API Collection File:** [`tests/api/auth_api_collection.json`](file:///tests/api/auth_api_collection.json)  

---

## 1. Executive Summary & Defect Discovery

We executed two complementary testing suites:
1. **The Hardened Baseline Suite (`ComprehensiveAuthSecurityTest`)**: 28 tests verifying currently implemented business rules, JWT signing, token rotation, and anti-enumeration. All **28 passed**.
2. **The Breaking & Defect Discovery Suite (`AuthDefectsAndEdgeCasesTest`)**: 5 tests specifically written to attack the system using OWASP standards, clinical/HIPAA compliance criteria, and logic inconsistencies. **All 5 tests failed**, discovering **critical security gaps and privilege escalation flaws** that require immediate fixes by the team.

```
+-------------------------------------------------------------------------+
|                         COMBINED QA METRICS                             |
+-----------------------------+----------+--------+--------+--------------+
| Suite Category              | Executed | Passed | Failed | Pass Rate    |
+-----------------------------+----------+--------+--------+--------------+
| Baseline Security Controls  | 28       | 28     | 0      | 100%         |
| Defect Discovery Suite      | 5        | 0      | 5      | 0% (5 Bugs)  |
+-----------------------------+----------+--------+--------+--------------+
| OVERALL COMBINED            | 33       | 28     | 5      | 84.8%        |
+-----------------------------+----------+--------+--------+--------------+
```

---

## 2. 🚨 Discovered Defects & Failing Test Cases (Action Required by Team)

Below are the 5 test cases that **deliberately fail the build** because our backend currently lacks the necessary defense or has logic flaws:

```
[ERROR] Failures: 
[ERROR]   AuthDefectsAndEdgeCasesTest.test_defect_01_pharmacist_self_registration_should_be_blocked:72 Status expected:<400> but was:<201>
[ERROR]   AuthDefectsAndEdgeCasesTest.test_defect_02_staff_self_registration_should_be_blocked:91 Status expected:<400> but was:<201>
[ERROR]   AuthDefectsAndEdgeCasesTest.test_defect_03_trivial_weak_password_should_be_rejected:112 Status expected:<400> but was:<201>
[ERROR]   AuthDefectsAndEdgeCasesTest.test_defect_04_garbage_phone_number_should_be_rejected:132 Status expected:<400> but was:<201>
[ERROR]   AuthDefectsAndEdgeCasesTest.test_defect_05_brute_force_logins_should_be_rate_limited:165 Status expected:<429> but was:<401>
```

### Defect 1: Privilege Escalation — Public Self-Registration as `PHARMACIST`
* **Test ID:** `DEFECT-01` (`test_defect_01_pharmacist_self_registration_should_be_blocked`)
* **Severity:** **HIGH (Security Hole)**
* **Expected:** `400 Bad Request` (`"Pharmacist accounts cannot self-register"`)
* **Actual:** `201 Created` with full Bearer access token issued.
* **Root Cause:** In `AuthService.java` (line 58), the developer comment explicitly states:
  ```java
  // Admin and pharmacist self-signup is not allowed from the public endpoint.
  if (req.role() == Role.ADMIN) {
      throw new BusinessRuleException("Admin accounts cannot self-register");
  }
  ```
  The developer documented the rule but forgot to include `|| req.role() == Role.PHARMACIST` in the condition! Any anonymous user can register directly as a Pharmacist.
* **Fix Required:**
  ```java
  if (req.role() == Role.ADMIN || req.role() == Role.PHARMACIST || req.role() == Role.STAFF) {
      throw new BusinessRuleException(req.role() + " accounts cannot self-register");
  }
  ```

---

### Defect 2: Privilege Escalation — Public Self-Registration as `STAFF`
* **Test ID:** `DEFECT-02` (`test_defect_02_staff_self_registration_should_be_blocked`)
* **Severity:** **HIGH (Security Hole)**
* **Expected:** `400 Bad Request`
* **Actual:** `201 Created`
* **Root Cause:** Only `ADMIN` was checked. `Role.STAFF` is accepted without administrative provisioning.
* **Fix Required:** Restrict public registration strictly to `Role.PATIENT` and `Role.DOCTOR`.

---

### Defect 3: Weak / Trivial Password Acceptance
* **Test ID:** `DEFECT-03` (`test_defect_03_trivial_weak_password_should_be_rejected`)
* **Severity:** **MEDIUM (Compliance / OWASP)**
* **Expected:** `400 Bad Request` (Password does not meet complexity rules)
* **Actual:** `201 Created` (Passes with password `"12345678"`, `"password"`, or `"aaaaaaaa"`)
* **Root Cause:** `RegisterRequest.java` only defines `@Size(min = 8, max = 100)` with no regex pattern enforcing uppercase, lowercase, numbers, or symbols.
* **Fix Required:** Add regex validation in `RegisterRequest.java`:
  ```java
  @Pattern(
      regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!]).{8,}$",
      message = "Password must contain at least one digit, one uppercase, one lowercase, and one special character"
  )
  ```

---

### Defect 4: Garbage / Non-Numeric Phone Numbers Accepted
* **Test ID:** `DEFECT-04` (`test_defect_04_garbage_phone_number_should_be_rejected`)
* **Severity:** **LOW/MEDIUM (Data Integrity)**
* **Expected:** `400 Bad Request`
* **Actual:** `201 Created` (Saves `"NOT_A_PHONE_NUMBER_$$$#@"` directly into PostgreSQL user table)
* **Root Cause:** `RegisterRequest.java` has `@Size(max = 50)` on phone but zero format or E.164 regex validation.
* **Fix Required:** Add `@Pattern(regexp = "^\\+?[1-9]\\d{1,14}$", message = "Invalid phone number format")` or validate via Google's `libphonenumber`.

---

### Defect 5: Lack of Rate Limiting / Account Lockout Against Brute-Force Logins
* **Test ID:** `DEFECT-05` (`test_defect_05_brute_force_logins_should_be_rate_limited`)
* **Severity:** **HIGH (Vulnerability to Credential Stuffing & Brute Force)**
* **Expected:** `429 Too Many Requests` or temporary account lockout after 5–10 consecutive failures.
* **Actual:** Returns `401 Unauthorized` endlessly without throttling.
* **Root Cause:** Neither `AuthController` nor Spring Security configuration has Bucket4j / Redis rate limiting or a login failure counter mechanism.
* **Fix Required:** Integrate Spring Security `AuthenticationFailureBadCredentialsEvent` listener with Redis or an in-memory sliding window cache to lock accounts for 15 minutes after 5 failed attempts or return HTTP 429.

---

## 3. Passing Baseline Test Matrix (28 Passed)

These 28 test cases verify our existing security boundaries in `ComprehensiveAuthSecurityTest.java`:

### Group 1: Registration & Bean Validation
| Test ID | Scenario | Input / Request Payload | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-01** | Valid Patient registration | Email, password (`Password@123`), full name, role `PATIENT` | `201 Created`, Bearer token issued, user row in DB | `201 Created`, token pair returned, role confirmed | **PASS** |
| **TC-AUTH-02** | Valid Doctor registration | Email, password, name, specialty (`Cardiology`), license (`MCI-45892`), role `DOCTOR` | `201 Created`, doctor status set to `PENDING` | `201 Created`, doctor created in PENDING review status | **PASS** |
| **TC-AUTH-03** | Privilege Escalation: Admin self-registration | Request with role `ADMIN` | `400 Bad Request`, `"Admin accounts cannot self-register"` | `400 Bad Request`, escalation blocked | **PASS** |
| **TC-AUTH-04** | Missing required Doctor specialty | Doctor sign-up with whitespace specialty `"   "` | `400 Bad Request`, `"Specialty is required for doctor sign-up"` | `400 Bad Request`, custom exception handled | **PASS** |
| **TC-AUTH-05** | Missing Medical Registration Number | Doctor sign-up with empty license `""` | `400 Bad Request`, `"Medical registration number is required for doctor sign-up"` | `400 Bad Request`, license mandatory check passed | **PASS** |
| **TC-AUTH-06** | Case-insensitive duplicate email | Register `unique.patient@example.com`, then attempt `UNIQUE.PATIENT@EXAMPLE.COM` | `409 Conflict`, `"Email already registered: ..."` | `409 Conflict`, duplicate collision prevented | **PASS** |
| **TC-AUTH-07** | Malformed email string | Invalid string `not-a-valid-email-string` | `400 Bad Request`, Spring `@Email` field validation error | `400 Bad Request`, bean validation caught input | **PASS** |
| **TC-AUTH-08** | Short password violation | Password with length < 8 chars (`"12345"`) | `400 Bad Request`, `@Size(min=8)` constraint error | `400 Bad Request`, field validation triggered | **PASS** |

### Group 2: Login & Credential Verification
| Test ID | Scenario | Input / Request Payload | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-09** | Valid credential login | Existing user email + valid BCrypt password | `200 OK`, valid access + refresh JWTs, user DTO | `200 OK`, tokens returned, session active | **PASS** |
| **TC-AUTH-10** | Incorrect password | Valid registered email + incorrect password | `401 Unauthorized` | `401 Unauthorized`, bad credentials handled | **PASS** |
| **TC-AUTH-11** | Non-existent user login | Unregistered email address | `401 Unauthorized` | `401 Unauthorized`, user not found | **PASS** |
| **TC-AUTH-12A** | Raw SQL Injection string in login | Email: `' OR '1'='1` | `400 Bad Request` via `@Email` bean validation | `400 Bad Request`, stopped before DB query | **PASS** |
| **TC-AUTH-12B** | SQL Injection formatted as email | Email: `admin'--@example.com` | `401 Unauthorized` via JPA parameterized query (no 500) | `401 Unauthorized`, parameter binding protected DB | **PASS** |
| **TC-AUTH-13** | Deactivated account login | Account with `enabled = false` | `401 Unauthorized` (disabled account blocked) | `401 Unauthorized`, Spring Security disabled check | **PASS** |

### Group 3: Token Lifecycle & Tampering
| Test ID | Scenario | Input / Request Payload | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-14** | Valid JWT to `/api/auth/me` | Bearer token signed with system secret | `200 OK`, returns user principal DTO | `200 OK`, authenticated identity returned | **PASS** |
| **TC-AUTH-15** | Anonymous access to `/api/auth/me` | No Authorization header | `401 Unauthorized` | `401 Unauthorized`, anonymous access denied | **PASS** |
| **TC-AUTH-16** | Tampered JWT payload / signature | Valid token with modified payload chars (`parts[1] + "X"`) | `401 Unauthorized` (HMAC signature verification failure) | `401 Unauthorized`, signature mismatch detected | **PASS** |
| **TC-AUTH-17** | Garbage / malformed Bearer header | Header: `Bearer garbage.invalid.token` | `401 Unauthorized` | `401 Unauthorized`, token parser caught syntax | **PASS** |

### Group 4: Refresh Token Mechanics & Replay Attack Prevention
| Test ID | Scenario | Input / Request Payload | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-18A** | Refresh token rotation | Post valid refresh token to `/api/auth/refresh` | `200 OK`, new access token & new refresh token issued | `200 OK`, new token pair generated | **PASS** |
| **TC-AUTH-18B** | Refresh token replay attack | Post previous refresh token already consumed in 18A | `401 Unauthorized` (single-use token already revoked) | `401 Unauthorized`, token reuse blocked | **PASS** |
| **TC-AUTH-19** | Logout revokes active session | Call `POST /api/auth/logout`, then attempt refresh | `204 No Content` on logout, `401 Unauthorized` on refresh | `204` on logout; subsequent refresh rejected with `401` | **PASS** |

### Group 5: Self-Service Password Reset
| Test ID | Scenario | Input / Request Payload | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-20** | Anti-enumeration on unknown email | Request reset for unregistered email | `200 OK` generic message, 0 tokens generated in DB | `200 OK`, no information leaked to attacker | **PASS** |
| **TC-AUTH-21A** | Valid password reset completion | Valid SHA-256 hashed token + new password | `200 OK`, password updated in DB | `200 OK`, password changed successfully | **PASS** |
| **TC-AUTH-21B** | Invalidation of old password | Login with old password after reset | `401 Unauthorized` | `401 Unauthorized`, old password no longer works | **PASS** |
| **TC-AUTH-21C** | Authentication with new password | Login with newly reset password | `200 OK`, Bearer token issued | `200 OK`, login successful | **PASS** |
| **TC-AUTH-22** | Invalid / fabricated reset token | Confirm with unknown token `"fake_token_not_in_db"` | `400 Bad Request`, `"Invalid or expired reset link"` | `400 Bad Request`, rejected cleanly | **PASS** |
| **TC-AUTH-23** | Expired reset token rejection | Token with `expiresAt` in the past | `400 Bad Request`, `"Invalid or expired reset link"` | `400 Bad Request`, expired token rejected | **PASS** |
| **TC-AUTH-24** | Replay of already used reset token | Re-submit token where `usedAt` is not null | `400 Bad Request`, `"Invalid or expired reset link"` | `400 Bad Request`, replay attempt stopped | **PASS** |

### Group 6: Role-Based Access Control (RBAC) & Privilege Boundaries
| Test ID | Scenario | Input / Request Payload | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-25** | Patient blocked from Admin Overview | `GET /api/v1/admin/overview` with `PATIENT` Bearer token | `403 Forbidden` (`hasRole('ADMIN')` enforcement) | `403 Forbidden`, privilege boundary held | **PASS** |
| **TC-AUTH-26** | Patient blocked from Doctor Portal | `GET /api/v1/doctors/me` with `PATIENT` Bearer token | `403 Forbidden` (`hasRole('DOCTOR')` enforcement) | `403 Forbidden`, privilege boundary held | **PASS** |
| **TC-AUTH-27** | Doctor blocked from Admin verification | `GET /api/v1/admin/doctors` with `DOCTOR` Bearer token | `403 Forbidden` (`hasRole('ADMIN')` enforcement) | `403 Forbidden`, privilege boundary held | **PASS** |
| **TC-AUTH-28** | Authorized Admin access | `GET /api/v1/admin/overview` with `ADMIN` Bearer token | `200 OK`, admin telemetry payload returned | `200 OK`, authorized access granted | **PASS** |

---

## 4. How to Run These Tests

### 1. Run the Failing Defect Suite (Observe the 5 Failures):
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:PATH = "C:\Program Files\Java\jdk-21\bin;$env:PATH"
mvn -f apps/backend/pom.xml test -Dtest=AuthDefectsAndEdgeCasesTest
```

### 2. Run the Passing Baseline Suite:
```powershell
mvn -f apps/backend/pom.xml test -Dtest=ComprehensiveAuthSecurityTest
```
