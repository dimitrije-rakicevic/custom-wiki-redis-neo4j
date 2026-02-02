namespace CustomWiki.DTOs;

public record CreatePageRequest(string Title, string Content);
public record UpdatePageRequest(string Title, string Content);
public record CreateRelationshipRequest(
    string FromPageId,
    string ToPageId,
    string RelationType,
    string? CustomLabel = null,
    bool IsBidirectional = false
);
public record PageRelationship(
    string RelationshipId,
    string RelationType,
    string FromPageId,
    string FromPageTitle,
    string ToPageId,
    string ToPageTitle,
    string? CustomLabel,
    DateTime CreatedAt
);
public static class RelationshipTypes
{
    public const string Prerequisite = "prerequisite";
    public const string SimilarTopic = "similar_topic";
    public const string ContinuesFrom = "continues_from";
    public const string SeeAlso = "see_also";
    public const string Custom = "custom";
}