namespace InternationalStudents.Printing.Domain;

/// <summary>Row in the student picker. Deliberately excludes passport and contact data.</summary>
public sealed record StudentSummary(int Id, string FullName, string Nationality, string Status);

/// <summary>Active template as listed in the template picker.</summary>
public sealed record TemplateSummary(string Code, string Name, string? Description);

/// <summary>A row of print_template.</summary>
public sealed record PrintTemplate(
    int Id, string Code, string Name, string? PaymentPurpose, string BodyHtml, int Version);

/// <summary>Values of template_field.source_entity.</summary>
public enum SourceEntity { User, Student, Payment, System }

/// <summary>A row of template_field: how one {{placeholder}} gets its value.</summary>
public sealed record TemplateField(
    string PlaceholderKey,
    SourceEntity SourceEntity,
    string SourceColumn,
    string? FormatString,
    string? DefaultValue,
    bool IsRequired);

/// <summary>A pending payment row of the student, for the template's payment_purpose.</summary>
public sealed record PendingPayment(int Id, decimal Amount, string Purpose, string Status, DateTime? PaidAt);

public enum PrintOutcome { Success, Failed }

/// <summary>A row to insert into print_log.</summary>
public sealed record PrintLogEntry(
    string ReferenceNo,
    int StudentId,
    int TemplateId,
    int TemplateVersion,
    int RequestedByUserId,
    PrintOutcome Outcome,
    string? ErrorMessage);
