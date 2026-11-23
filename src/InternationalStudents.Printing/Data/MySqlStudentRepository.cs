using System.Globalization;
using InternationalStudents.Printing.Domain;
using MySqlConnector;

namespace InternationalStudents.Printing.Data;

public sealed class MySqlStudentRepository(MySqlDataSource dataSource) : IStudentRepository
{
    private const string SearchSql = """
        SELECT u.id, u.full_name, s.nationality, s.status
        FROM student s
        JOIN `user` u ON u.id = s.user_id
        WHERE u.role = 'STUDENT'
          AND (@like IS NULL OR u.full_name LIKE @like OR u.id = @id)
        ORDER BY u.full_name, u.id
        LIMIT @limit OFFSET @offset
        """;

    // Explicit column lists: password_hash is never selected, so it can never be printed.
    private const string StudentSql = """
        SELECT u.id, u.full_name, u.email, u.phone,
               s.user_id, s.nationality, s.passport_number, s.date_of_birth, s.status
        FROM student s
        JOIN `user` u ON u.id = s.user_id
        WHERE s.user_id = @id AND u.role = 'STUDENT'
        LIMIT 1
        """;

    private const string PendingPaymentsSql = """
        SELECT id, amount, purpose, status, paid_at
        FROM payment
        WHERE student_id = @studentId AND purpose = @purpose AND status = 'PENDING'
        ORDER BY id
        """;

    private const string IsStaffSql = """
        SELECT COUNT(*) FROM `user` WHERE id = @id AND role IN ('ADMIN', 'ADVISOR')
        """;

    public async Task<IReadOnlyList<StudentSummary>> SearchAsync(
        string? search, int limit, int offset, CancellationToken ct)
    {
        string? like = null;
        object? idValue = null;

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            like = "%" + Sql.EscapeLike(term) + "%";
            if (int.TryParse(term, NumberStyles.None, CultureInfo.InvariantCulture, out var id))
            {
                idValue = id;
            }
        }

        await using var command = dataSource.CreateCommand(SearchSql);
        command.AddParameter("@like", like);
        command.AddParameter("@id", idValue);
        command.AddParameter("@limit", limit);
        command.AddParameter("@offset", offset);

        var result = new List<StudentSummary>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            result.Add(new StudentSummary(
                reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetString(3)));
        }

        return result;
    }

    public async Task<IReadOnlyDictionary<SourceEntity, IReadOnlyDictionary<string, object?>>?> GetStudentSourcesAsync(
        int studentId, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(StudentSql);
        command.AddParameter("@id", studentId);

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        object? V(int i) => reader.IsDBNull(i) ? null : reader.GetValue(i);

        var user = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["id"] = V(0), ["full_name"] = V(1), ["email"] = V(2), ["phone"] = V(3),
        };
        var student = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["user_id"] = V(4), ["nationality"] = V(5), ["passport_number"] = V(6),
            ["date_of_birth"] = V(7), ["status"] = V(8),
        };

        return new Dictionary<SourceEntity, IReadOnlyDictionary<string, object?>>
        {
            [SourceEntity.User] = user,
            [SourceEntity.Student] = student,
        };
    }

    public async Task<IReadOnlyList<PendingPayment>> GetPendingPaymentsAsync(
        int studentId, string purpose, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(PendingPaymentsSql);
        command.AddParameter("@studentId", studentId);
        command.AddParameter("@purpose", purpose);

        var result = new List<PendingPayment>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            result.Add(new PendingPayment(
                reader.GetInt32(0),
                reader.GetDecimal(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetDateTime(4)));
        }

        return result;
    }

    public async Task<bool> IsStaffAsync(int userId, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(IsStaffSql);
        command.AddParameter("@id", userId);
        return Convert.ToInt64(await command.ExecuteScalarAsync(ct), CultureInfo.InvariantCulture) > 0;
    }
}
