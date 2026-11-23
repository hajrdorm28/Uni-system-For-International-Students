using System.ComponentModel.DataAnnotations;

namespace InternationalStudents.Printing.Configuration;

/// <summary>
/// Stand-in access control for this module only. The README requires role-based access, but
/// sign-in belongs to another module; until it is wired in, /api and /print require this key.
/// </summary>
public sealed class SecurityOptions
{
    public const string SectionName = "Security";
    public const string HeaderName = "X-Admin-Key";

    /// <summary>
    /// Header naming the staff user (user.id, role ADMIN or ADVISOR) who prints. Needed because
    /// print_log.requested_by_user_id is NOT NULL. Only as trustworthy as the key check above.
    /// </summary>
    public const string UserHeaderName = "X-Admin-User-Id";

    [Required, MinLength(16, ErrorMessage = "AdminApiKey must be at least 16 characters.")]
    public string AdminApiKey { get; set; } = "";
}
