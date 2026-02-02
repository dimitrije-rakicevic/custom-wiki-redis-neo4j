using ServiceStack;

namespace CustomWiki.Configurations;
public class RedisConfiguration
{
    public string? Host { get; set; }
    public string? Port { get; set; }
    public string? Password { get; set; }
    public string? User { get; set; }

    public RedisConfiguration()
    {
        Host = Environment.GetEnvironmentVariable("REDIS_HOST");
        User = Environment.GetEnvironmentVariable("REDIS_USER");
        Port = Environment.GetEnvironmentVariable("REDIS_PORT");
        Password = Environment.GetEnvironmentVariable("REDIS_PASSWORD");
    }

    public void Validate()
    {
        if (string.IsNullOrEmpty(Host))
            throw new InvalidOperationException("REDIS_HOST environment variable is not set");
        if (string.IsNullOrEmpty(User))
            throw new InvalidOperationException("REDIS_USER environment variable is not set");
        if (string.IsNullOrEmpty(Port))
            throw new InvalidOperationException("REDIS_PORT environment variable is not set");
        if (string.IsNullOrEmpty(Password))
            throw new InvalidOperationException("REDIS_PASSWORD environment variable is not set");
        Console.WriteLine("PORT: " + Port);
    }

    public string GetConnectionString()
    {
        return $"{Password}@{Host}:{Port}";
    }
}
