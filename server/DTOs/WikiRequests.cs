namespace CustomWiki.DTOs;

public record CreateWikiRequest(string Name, string Description, bool IsPrivate = false);

public record UpdateWikiRequest(string Name, string Description, bool IsPrivate);