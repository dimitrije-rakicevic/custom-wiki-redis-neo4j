namespace CustomWiki.DTOs;

public record ChatMessage(string userId, string username, string message, DateTime timestamp);