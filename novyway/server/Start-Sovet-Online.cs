using System;
using System.Diagnostics;
using System.IO;
using System.Net;

internal static class StartSovetOnline
{
    private const string LocalHealthUrl = "http://127.0.0.1:4176/__health";
    private const string PublicUrl = "https://novyway.com/";

    private static int Main(string[] args)
    {
        Console.Title = "Novyway site control";
        var root = AppDomain.CurrentDomain.BaseDirectory;

        if (args.Length > 0 && args[0] == "--status")
        {
            var healthy = IsSiteRunning();
            Console.WriteLine(healthy ? "RUNNING" : "STOPPED");
            return healthy ? 0 : 1;
        }

        if (IsSiteRunning())
        {
            return ShowRunningMenu(root);
        }

        return StartServer(root);
    }

    private static int ShowRunningMenu(string root)
    {
        Console.WriteLine("Novyway is running.");
        Console.WriteLine("Public address: " + PublicUrl);
        Console.WriteLine();
        Console.WriteLine("[O] Open the site");
        Console.WriteLine("[A] Open the local operator console");
        Console.WriteLine("[R] Restart the site server");
        Console.WriteLine("[S] Stop the site server");
        Console.WriteLine("[Q] Leave it running and close this window");
        Console.WriteLine();
        Console.Write("Choose an action: ");

        var key = Console.ReadKey(true).Key;
        Console.WriteLine();
        if (key == ConsoleKey.O)
        {
            OpenPublicSite();
            return 0;
        }
        if (key == ConsoleKey.A)
        {
            var admin = Path.Combine(root, "Sovet-Online-Admin.exe");
            if (File.Exists(admin)) Process.Start(new ProcessStartInfo { FileName = admin, WorkingDirectory = root, UseShellExecute = true });
            else return Fail("Sovet-Online-Admin.exe is missing.");
            return 0;
        }
        if (key == ConsoleKey.R)
        {
            if (!StopManagedServer(root)) return Fail("The running server could not be safely restarted.");
            return StartServer(root);
        }
        if (key == ConsoleKey.S)
        {
            return StopManagedServer(root) ? 0 : Fail("The running server could not be safely stopped.");
        }
        return 0;
    }

    private static int StartServer(string root)
    {
        var serverScript = Path.Combine(root, "server", "static-server.mjs");
        var distIndex = Path.Combine(root, "dist", "index.html");
        var node = FindNode();

        if (node == null) return Fail("Node.js was not found. Install Node.js and run this file again.");
        if (!File.Exists(serverScript)) return Fail("Server script is missing: " + serverScript);
        if (!File.Exists(distIndex)) return Fail("Production build is missing: " + distIndex);
        if (!EnsurePostgreSql(root)) return Fail("PostgreSQL could not be started. Run server\\Setup-PostgreSQL.ps1 and check the PostgreSQL log.");

        Console.WriteLine("Starting Novyway...");
        Console.WriteLine("Local status:  http://127.0.0.1:4176/__health");
        Console.WriteLine("Public address: " + PublicUrl);
        Console.WriteLine("Operator console: Sovet-Online-Admin.exe");
        Console.WriteLine("Keep this window open. Press Ctrl+C to stop the site.");
        Console.WriteLine();

        var firstStart = true;
        var consecutiveFailures = 0;
        while (true)
        {
            var launchedAt = DateTime.UtcNow;
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = node,
                Arguments = "\"" + serverScript + "\" --host 127.0.0.1 --port 4176 --ops-port 4177" + (firstStart ? " --open" : ""),
                WorkingDirectory = root,
                UseShellExecute = false,
            });

            if (process == null) return Fail("The Node.js server could not be started.");
            process.WaitForExit();
            if (process.ExitCode == 0) return 0;
            if (process.ExitCode != 75)
            {
                consecutiveFailures = (DateTime.UtcNow - launchedAt).TotalSeconds > 30 ? 1 : consecutiveFailures + 1;
                if (consecutiveFailures >= 5) return Fail("The site server stopped repeatedly. Last exit code: " + process.ExitCode + ".");
                Console.WriteLine("The service stopped with exit code " + process.ExitCode + ". Retrying in 3 seconds...");
                System.Threading.Thread.Sleep(3000);
            }
            else
            {
                consecutiveFailures = 0;
            }
            firstStart = false;
            Console.WriteLine("Restart requested. Starting the service again...");
            System.Threading.Thread.Sleep(800);
        }
    }

    private static bool StopManagedServer(string root)
    {
        var pidFile = Path.Combine(root, ".runtime", "site.pid");
        if (!File.Exists(pidFile))
        {
            Console.Error.WriteLine("No managed server PID was found. Close the old server window once, then start the updated launcher.");
            return false;
        }

        int pid;
        if (!int.TryParse(File.ReadAllText(pidFile).Trim(), out pid)) return false;

        try
        {
            var process = Process.GetProcessById(pid);
            if (!string.Equals(process.ProcessName, "node", StringComparison.OrdinalIgnoreCase)) return false;
            process.Kill();
            process.WaitForExit(5000);
            if (File.Exists(pidFile)) File.Delete(pidFile);
            for (var attempt = 0; attempt < 20 && IsSiteRunning(); attempt++) System.Threading.Thread.Sleep(100);
            return !IsSiteRunning();
        }
        catch (ArgumentException)
        {
            if (File.Exists(pidFile)) File.Delete(pidFile);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsSiteRunning()
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(LocalHealthUrl);
            request.Method = "GET";
            request.Timeout = 1500;
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                return response.StatusCode == HttpStatusCode.OK && reader.ReadToEnd().Contains("novyway-site");
            }
        }
        catch
        {
            return false;
        }
    }

    private static string FindNode()
    {
        var standardNode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
        if (File.Exists(standardNode)) return standardNode;
        foreach (var directory in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            if (string.IsNullOrWhiteSpace(directory)) continue;
            var candidate = Path.Combine(directory.Trim(), "node.exe");
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static bool EnsurePostgreSql(string root)
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var dataRoot = Environment.GetEnvironmentVariable("SOVET_ONLINE_DATA_DIR");
        if (string.IsNullOrWhiteSpace(dataRoot)) dataRoot = Path.Combine(localAppData, "SovetOnline");
        var bin = Path.Combine(dataRoot, "PostgreSQL17", "pgsql", "bin");
        var pgIsReady = Path.Combine(bin, "pg_isready.exe");
        var pgCtl = Path.Combine(bin, "pg_ctl.exe");
        var cluster = Path.Combine(dataRoot, "postgres-data");
        var log = Path.Combine(dataRoot, "logs", "postgresql.log");

        if (!File.Exists(pgCtl) || !Directory.Exists(cluster))
        {
            var setup = Path.Combine(root, "server", "Setup-PostgreSQL.ps1");
            if (!File.Exists(setup)) return false;
            Console.WriteLine("PostgreSQL is not installed. Running the local setup...");
            var installer = Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + setup + "\"",
                WorkingDirectory = root,
                UseShellExecute = false,
            });
            if (installer == null) return false;
            installer.WaitForExit();
            if (installer.ExitCode != 0 || !File.Exists(pgCtl)) return false;
        }

        if (PostgreSqlIsReady(pgIsReady)) return true;
        Directory.CreateDirectory(Path.GetDirectoryName(log));
        var starter = Process.Start(new ProcessStartInfo
        {
            FileName = pgCtl,
            Arguments = "start -D \"" + cluster + "\" -l \"" + log + "\" -w",
            UseShellExecute = false,
            CreateNoWindow = true,
        });
        if (starter == null) return false;
        starter.WaitForExit();
        return starter.ExitCode == 0 && PostgreSqlIsReady(pgIsReady);
    }

    private static bool PostgreSqlIsReady(string pgIsReady)
    {
        if (!File.Exists(pgIsReady)) return false;
        try
        {
            var check = Process.Start(new ProcessStartInfo
            {
                FileName = pgIsReady,
                Arguments = "-h 127.0.0.1 -p 55432 -d sovet_online",
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            if (check == null) return false;
            check.WaitForExit(3000);
            return check.HasExited && check.ExitCode == 0;
        }
        catch { return false; }
    }

    private static void OpenPublicSite()
    {
        OpenUrl(PublicUrl);
    }

    private static void OpenUrl(string url)
    {
        try { Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true }); }
        catch { }
    }

    private static int Fail(string message)
    {
        Console.Error.WriteLine();
        Console.Error.WriteLine(message);
        Console.WriteLine("Press any key to close this window.");
        if (!Console.IsInputRedirected) Console.ReadKey(true);
        return 1;
    }
}
