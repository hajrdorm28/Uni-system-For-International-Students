-- =============================================================================
-- printing_app_grants.sql  -  least-privilege account for the printing module
-- Run against YOUR existing database (uni_international). No tables are created or changed.
--
--  * SELECT only on the columns the module reads. user.password_hash is NOT granted,
--    so even a bug or a bad template mapping cannot expose it.
--  * INSERT only on print_log (the audit trail): no UPDATE or DELETE, so rows cannot be altered.
--
-- Replace the password placeholder, then put the same password in the connection string
-- (user-secrets / environment variable). On a managed server (e.g. Azure), create the user in
-- the provider's portal or with the admin account, then run the GRANT lines.
-- =============================================================================
CREATE USER IF NOT EXISTS 'printing_app'@'%' IDENTIFIED BY 'SQLsafe112@@';

GRANT SELECT (id, full_name, email, phone, role) ON uni_international.`user` TO 'printing_app'@'%';
GRANT SELECT ON uni_international.student        TO 'printing_app'@'%';
GRANT SELECT ON uni_international.payment        TO 'printing_app'@'%';
GRANT SELECT ON uni_international.print_template TO 'printing_app'@'%';
GRANT SELECT ON uni_international.template_field TO 'printing_app'@'%';
GRANT INSERT ON uni_international.print_log      TO 'printing_app'@'%';
