using InternationalStudents.Printing.Domain;

namespace InternationalStudents.Printing.Data;

/// <summary>Access to print_template, template_field and print_log.</summary>
public interface IPrintRepository
{
    Task<IReadOnlyList<TemplateSummary>> ListActiveTemplatesAsync(CancellationToken ct);

    Task<PrintTemplate?> GetActiveTemplateAsync(string code, CancellationToken ct);

    Task<IReadOnlyList<TemplateField>> GetFieldsAsync(int templateId, CancellationToken ct);

    /// <summary>Inserts a print_log row. Returns false if reference_no is already taken.</summary>
    Task<bool> TryInsertLogAsync(PrintLogEntry entry, CancellationToken ct);
}
