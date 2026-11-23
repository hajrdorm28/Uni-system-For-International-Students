using InternationalStudents.Printing.Domain;
using MySqlConnector;

namespace InternationalStudents.Printing.Data;

public sealed class MySqlPrintRepository(MySqlDataSource dataSource) : IPrintRepository
{
    private const string ListSql = """
        SELECT code, name, description FROM print_template WHERE is_active = 1 ORDER BY name, code
        """;

    private const string GetTemplateSql = """
        SELECT id, code, name, payment_purpose, body_html, version
        FROM print_template
        WHERE code = @code AND is_active = 1
        LIMIT 1
        """;

    private const string FieldsSql = """
        SELECT placeholder_key, source_entity, source_column, format_string, default_value, is_required
        FROM template_field
        WHERE template_id = @templateId
        """;

    private const string InsertLogSql = """
        INSERT INTO print_log
            (reference_no, student_id, template_id, template_version, requested_by_user_id, status, error_message)
        VALUES
            (@reference, @student, @template, @version, @requester, @status, @error)
        """;

    public async Task<IReadOnlyList<TemplateSummary>> ListActiveTemplatesAsync(CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(ListSql);
        var result = new List<TemplateSummary>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            result.Add(new TemplateSummary(
                reader.GetString(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetString(2)));
        }

        return result;
    }

    public async Task<PrintTemplate?> GetActiveTemplateAsync(string code, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(GetTemplateSql);
        command.AddParameter("@code", code);

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new PrintTemplate(
            reader.GetInt32(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.GetString(4),
            reader.GetInt32(5));
    }

    public async Task<IReadOnlyList<TemplateField>> GetFieldsAsync(int templateId, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(FieldsSql);
        command.AddParameter("@templateId", templateId);

        var result = new List<TemplateField>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var entityText = reader.GetString(1);
            if (!Enum.TryParse<SourceEntity>(entityText, ignoreCase: true, out var entity))
            {
                throw new InvalidOperationException($"Unknown source_entity '{entityText}' in template_field.");
            }

            result.Add(new TemplateField(
                reader.GetString(0),
                entity,
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.GetBoolean(5)));
        }

        return result;
    }

    public async Task<bool> TryInsertLogAsync(PrintLogEntry entry, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(InsertLogSql);
        command.AddParameter("@reference", entry.ReferenceNo);
        command.AddParameter("@student", entry.StudentId);
        command.AddParameter("@template", entry.TemplateId);
        command.AddParameter("@version", entry.TemplateVersion);
        command.AddParameter("@requester", entry.RequestedByUserId);
        command.AddParameter("@status", entry.Outcome == PrintOutcome.Success ? "SUCCESS" : "FAILED");
        command.AddParameter("@error", Truncate(entry.ErrorMessage, 500));

        try
        {
            await command.ExecuteNonQueryAsync(ct);
            return true;
        }
        catch (MySqlException ex) when (ex.ErrorCode == MySqlErrorCode.DuplicateKeyEntry)
        {
            return false;   // reference_no collision: the caller picks a new reference
        }
    }

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}
