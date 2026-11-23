using System.ComponentModel.DataAnnotations;

namespace InternationalStudents.Printing.Configuration;

/// <summary>
/// Values for template fields whose source_entity is SYSTEM. The schema has no university table,
/// so the university name comes from configuration.
/// </summary>
public sealed class InstitutionOptions
{
    public const string SectionName = "Institution";

    /// <summary>Value of the SYSTEM field "university_name".</summary>
    [Required, StringLength(150)]
    public string UniversityName { get; set; } = "";

    /// <summary>
    /// Time zone used for the SYSTEM field "current_date" (IANA id such as "Africa/Cairo", or "UTC").
    /// Without it, a paper printed just after local midnight would show yesterday's date.
    /// </summary>
    [Required]
    public string TimeZoneId { get; set; } = "UTC";

    public static bool IsValidTimeZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return false;
        try { TimeZoneInfo.FindSystemTimeZoneById(id); return true; }
        catch (TimeZoneNotFoundException) { return false; }
        catch (InvalidTimeZoneException) { return false; }
    }
}
