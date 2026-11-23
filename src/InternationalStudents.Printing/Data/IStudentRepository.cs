using InternationalStudents.Printing.Domain;

namespace InternationalStudents.Printing.Data;

/// <summary>Read access to the user, student and payment tables.</summary>
public interface IStudentRepository
{
    Task<IReadOnlyList<StudentSummary>> SearchAsync(string? search, int limit, int offset, CancellationToken ct);

    /// <summary>
    /// Whitelisted USER and STUDENT columns of one student, keyed by column name
    /// (a null value means the column is NULL). Null if the student does not exist.
    /// </summary>
    Task<IReadOnlyDictionary<SourceEntity, IReadOnlyDictionary<string, object?>>?> GetStudentSourcesAsync(
        int studentId, CancellationToken ct);

    Task<IReadOnlyList<PendingPayment>> GetPendingPaymentsAsync(int studentId, string purpose, CancellationToken ct);

    /// <summary>True if the user exists and has role ADMIN or ADVISOR.</summary>
    Task<bool> IsStaffAsync(int userId, CancellationToken ct);
}
