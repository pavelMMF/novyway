using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

internal static class OperatorProgram
{
    [STAThread]
    private static void Main()
    {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
        app.Run(new OperatorWindow());
    }
}

internal sealed class OperatorWindow : Window
{
    private const string ApiRoot = "http://127.0.0.1:4177";
    private const string HealthUrl = "http://127.0.0.1:4176/__health";
    private const string PublicUrl = "https://novyway.com";
    private readonly JavaScriptSerializer json = new JavaScriptSerializer();
    private readonly Dictionary<string, TextBlock> values = new Dictionary<string, TextBlock>();
    private readonly DispatcherTimer timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };
    private readonly string root;
    private readonly string operatorKeyPath;
    private TextBlock statusText;
    private Border statusLamp;
    private TextBlock eventText;
    private TextBlock actionText;
    private CheckBox registration;
    private CheckBox sponsorship;
    private CheckBox maintenance;
    private TextBox voteLimit;
    private TextBox globalVoteLimit;
    private string protectedCreatorEmail = "pavel.mishelutov@gmail.com";
    private string protectedCreatorAddress = "0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411";
    private bool loading;
    private bool settingsDirty;

    private static readonly Brush Bg = Brush("#07110F");
    private static readonly Brush Surface = Brush("#0D1A17");
    private static readonly Brush Surface2 = Brush("#12231F");
    private static new readonly Brush BorderBrush = Brush("#2C4841");
    private static readonly Brush Ink = Brush("#EEF5F1");
    private static readonly Brush Muted = Brush("#8FA69F");
    private static readonly Brush Cyan = Brush("#12C7D5");
    private static readonly Brush Red = Brush("#F4473B");
    private static readonly Brush Gold = Brush("#D6A721");

    public OperatorWindow()
    {
        root = AppDomain.CurrentDomain.BaseDirectory;
        var dataRoot = Environment.GetEnvironmentVariable("SOVET_ONLINE_DATA_DIR");
        if (String.IsNullOrWhiteSpace(dataRoot)) dataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SovetOnline");
        operatorKeyPath = Path.Combine(dataRoot, "secrets", "operator-console.key");

        Title = "Novyway — операторский контур";
        Width = 1180;
        Height = 760;
        MinWidth = 940;
        MinHeight = 650;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.CanResizeWithGrip;
        Background = Bg;
        Foreground = Ink;
        FontFamily = new FontFamily("Segoe UI");
        Content = BuildLayout();

        timer.Tick += async delegate { await RefreshDashboard(); };
        Loaded += async delegate { timer.Start(); await RefreshDashboard(); };
        Closed += delegate { timer.Stop(); };
    }

    private UIElement BuildLayout()
    {
        var frame = new Border { BorderBrush = BorderBrush, BorderThickness = new Thickness(1), Background = Bg };
        var shell = new DockPanel();
        frame.Child = shell;
        var titleBar = BuildTitleBar();
        DockPanel.SetDock(titleBar, Dock.Top);
        shell.Children.Add(titleBar);

        var scroll = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled };
        var body = new Grid { Margin = new Thickness(22, 18, 22, 22) };
        body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(2.05, GridUnitType.Star) });
        body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(18) });
        body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        body.Children.Add(BuildTelemetry());
        var controls = BuildControls();
        Grid.SetColumn(controls, 2);
        body.Children.Add(controls);
        scroll.Content = body;
        shell.Children.Add(scroll);
        return frame;
    }

    private UIElement BuildTitleBar()
    {
        var bar = new Grid { Height = 72, Background = Surface, Cursor = Cursors.SizeAll };
        bar.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        bar.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        bar.MouseLeftButtonDown += delegate { try { DragMove(); } catch { } };

        var brand = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
        brand.Children.Add(new Border { Width = 7, Height = 36, Background = Red, Margin = new Thickness(0, 0, 13, 0) });
        var brandCopy = new StackPanel();
        brandCopy.Children.Add(Text("NOVYWAY", 20, Ink, FontWeights.Bold, "Segoe UI"));
        brandCopy.Children.Add(Text("OPERATOR NODE  /  LOCAL CONTROL", 10, Cyan, FontWeights.SemiBold, "Consolas"));
        brand.Children.Add(brandCopy);
        bar.Children.Add(brand);

        var actions = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 12, 0) };
        actions.Children.Add(ActionButton("ОТКРЫТЬ САЙТ", delegate { OpenUrl(PublicUrl); }, false));
        actions.Children.Add(WindowButton("—", delegate { WindowState = WindowState.Minimized; }));
        actions.Children.Add(WindowButton("×", delegate { Close(); }));
        Grid.SetColumn(actions, 1);
        bar.Children.Add(actions);
        return bar;
    }

    private UIElement BuildTelemetry()
    {
        var stack = new StackPanel();
        var status = Card();
        var statusRow = new Grid { Margin = new Thickness(18, 15, 18, 15) };
        statusRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        statusRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        statusRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        statusLamp = new Border { Width = 13, Height = 13, CornerRadius = new CornerRadius(7), Background = Muted, Margin = new Thickness(0, 0, 12, 0), VerticalAlignment = VerticalAlignment.Center };
        statusRow.Children.Add(statusLamp);
        statusText = Text("ПРОВЕРКА СИСТЕМЫ", 15, Ink, FontWeights.Bold, "Segoe UI");
        Grid.SetColumn(statusText, 1);
        statusRow.Children.Add(statusText);
        var build = Text("POSTGRESQL  /  APTOS TESTNET  /  CLOUDFLARE", 10, Muted, FontWeights.Normal, "Consolas");
        Grid.SetColumn(build, 2);
        statusRow.Children.Add(build);
        status.Child = statusRow;
        stack.Children.Add(status);

        var header = new StackPanel { Margin = new Thickness(2, 24, 0, 12) };
        header.Children.Add(Text("ТЕЛЕМЕТРИЯ 01", 10, Red, FontWeights.Bold, "Consolas"));
        header.Children.Add(Text("Живой контур сервиса", 28, Ink, FontWeights.Bold, "Segoe UI"));
        stack.Children.Add(header);

        var metrics = new UniformGrid { Columns = 3, Rows = 2 };
        metrics.Children.Add(Metric("uptime", "АПТАЙМ", "—", Cyan));
        metrics.Children.Add(Metric("users", "ПОЛЬЗОВАТЕЛИ", "—", Gold));
        metrics.Children.Add(Metric("sessions", "АКТИВНЫЕ СЕССИИ", "—", Cyan));
        metrics.Children.Add(Metric("votes", "ГОЛОСА / 24 Ч", "—", Red));
        metrics.Children.Add(Metric("memory", "ПАМЯТЬ ПРОЦЕССА", "—", Cyan));
        metrics.Children.Add(Metric("db", "POSTGRESQL", "—", Gold));
        stack.Children.Add(metrics);

        var eventsCard = Card(new Thickness(0, 18, 0, 0));
        var eventsStack = new StackPanel { Margin = new Thickness(18) };
        eventsStack.Children.Add(Text("ЖУРНАЛ 02", 10, Red, FontWeights.Bold, "Consolas"));
        eventsStack.Children.Add(Text("Последние события", 20, Ink, FontWeights.Bold, "Segoe UI"));
        eventText = Text("События загрузятся после подключения.", 12, Muted, FontWeights.Normal, "Consolas");
        eventText.Margin = new Thickness(0, 14, 0, 0);
        eventText.TextWrapping = TextWrapping.Wrap;
        eventsStack.Children.Add(eventText);
        eventsCard.Child = eventsStack;
        stack.Children.Add(eventsCard);
        return stack;
    }

    private UIElement BuildControls()
    {
        var stack = new StackPanel();
        stack.Children.Add(Text("КОНТРОЛЬ 03", 10, Red, FontWeights.Bold, "Consolas"));
        var title = Text("Операторский шлюз", 24, Ink, FontWeights.Bold, "Segoe UI");
        title.Margin = new Thickness(0, 2, 0, 12);
        stack.Children.Add(title);

        var settingsCard = Card();
        var settingsStack = new StackPanel { Margin = new Thickness(16) };
        settingsStack.Children.Add(Text("РЕЖИМ САЙТА", 10, Cyan, FontWeights.Bold, "Consolas"));
        registration = Toggle("Открыта регистрация");
        sponsorship = Toggle("Спонсирование голосов");
        maintenance = Toggle("Технические работы");
        settingsStack.Children.Add(registration);
        settingsStack.Children.Add(sponsorship);
        settingsStack.Children.Add(maintenance);
        settingsStack.Children.Add(Text("ЛИМИТ НА ПОЛЬЗОВАТЕЛЯ В ЧАС", 9, Muted, FontWeights.Normal, "Consolas"));
        voteLimit = new TextBox { Text = "20", Height = 38, Margin = new Thickness(0, 6, 0, 12), Padding = new Thickness(10, 7, 10, 7), Background = Bg, Foreground = Ink, BorderBrush = BorderBrush, FontFamily = new FontFamily("Consolas") };
        settingsStack.Children.Add(voteLimit);
        settingsStack.Children.Add(Text("ОБЩИЙ ЛИМИТ СПОНСИРОВАННЫХ ГОЛОСОВ В ЧАС", 9, Muted, FontWeights.Normal, "Consolas"));
        globalVoteLimit = new TextBox { Text = "250", Height = 38, Margin = new Thickness(0, 6, 0, 12), Padding = new Thickness(10, 7, 10, 7), Background = Bg, Foreground = Ink, BorderBrush = BorderBrush, FontFamily = new FontFamily("Consolas") };
        registration.Checked += MarkSettingsDirty;
        registration.Unchecked += MarkSettingsDirty;
        sponsorship.Checked += MarkSettingsDirty;
        sponsorship.Unchecked += MarkSettingsDirty;
        maintenance.Checked += MarkSettingsDirty;
        maintenance.Unchecked += MarkSettingsDirty;
        voteLimit.TextChanged += MarkSettingsTextDirty;
        globalVoteLimit.TextChanged += MarkSettingsTextDirty;
        settingsStack.Children.Add(globalVoteLimit);
        settingsStack.Children.Add(ActionButton("СОХРАНИТЬ НАСТРОЙКИ", async delegate { await SaveSettings(); }, false));
        settingsCard.Child = settingsStack;
        stack.Children.Add(settingsCard);

        var creatorCard = Card(new Thickness(0, 14, 0, 0));
        var creatorStack = new StackPanel { Margin = new Thickness(16) };
        creatorStack.Children.Add(Text("СОЗДАТЕЛЬ 04", 10, Cyan, FontWeights.Bold, "Consolas"));
        creatorStack.Children.Add(StatusLine("creator", "Аккаунт супер-администратора"));
        var creatorHint = Text("Почта, пароль и Google объединяются в одном профиле. Ключ creator не копируется в браузер или PostgreSQL.", 10, Muted, FontWeights.Normal, "Segoe UI");
        creatorHint.Margin = new Thickness(0, 9, 0, 0);
        creatorHint.TextWrapping = TextWrapping.Wrap;
        creatorStack.Children.Add(creatorHint);
        creatorStack.Children.Add(ActionButton("НАСТРОИТЬ АККАУНТ СОЗДАТЕЛЯ", delegate { ConfigureCreatorAccount(); }, false));
        creatorCard.Child = creatorStack;
        stack.Children.Add(creatorCard);

        var serviceCard = Card(new Thickness(0, 14, 0, 0));
        var serviceStack = new StackPanel { Margin = new Thickness(16) };
        serviceStack.Children.Add(Text("СЕРВИС 04", 10, Cyan, FontWeights.Bold, "Consolas"));
        serviceStack.Children.Add(ActionButton("ЗАПУСТИТЬ", async delegate { StartService(); await DelayRefresh(); }, false));
        serviceStack.Children.Add(ActionButton("НАСТРОИТЬ СЛУЖЕБНУЮ ПОЧТУ", delegate { ConfigureMail(); }, false));
        serviceStack.Children.Add(ActionButton("РЕЗЕРВНАЯ КОПИЯ", async delegate { await PostAction("/api/backups"); }, false));
        serviceStack.Children.Add(ActionButton("ПЕРЕЗАПУСТИТЬ", async delegate { await PostAction("/api/restart"); await DelayRefresh(); }, true));
        serviceStack.Children.Add(ActionButton("ОСТАНОВИТЬ", async delegate { await PostAction("/api/stop"); await DelayRefresh(); }, true));
        actionText = Text("Локальный API закрыт ключом оператора.", 10, Muted, FontWeights.Normal, "Consolas");
        actionText.Margin = new Thickness(0, 10, 0, 0);
        actionText.TextWrapping = TextWrapping.Wrap;
        serviceStack.Children.Add(actionText);
        serviceCard.Child = serviceStack;
        stack.Children.Add(serviceCard);

        var securityCard = Card(new Thickness(0, 14, 0, 0));
        var securityStack = new StackPanel { Margin = new Thickness(16) };
        securityStack.Children.Add(Text("ЗАЩИТА 05", 10, Cyan, FontWeights.Bold, "Consolas"));
        securityStack.Children.Add(StatusLine("aptos", "Aptos и bytecode"));
        securityStack.Children.Add(StatusLine("mail", "Служебная почта"));
        securityStack.Children.Add(StatusLine("relayer", "Баланс relayer"));
        securityCard.Child = securityStack;
        stack.Children.Add(securityCard);
        return stack;
    }

    private Border Metric(string key, string label, string initial, Brush accent)
    {
        var card = Card(new Thickness(0, 0, 10, 10));
        card.BorderBrush = accent;
        card.BorderThickness = new Thickness(1, 3, 1, 1);
        var stack = new StackPanel { Margin = new Thickness(15, 12, 15, 14) };
        stack.Children.Add(Text(label, 9, Muted, FontWeights.Normal, "Consolas"));
        var value = Text(initial, 24, Ink, FontWeights.Bold, "Consolas");
        value.Margin = new Thickness(0, 7, 0, 0);
        values[key] = value;
        stack.Children.Add(value);
        card.Child = stack;
        return card;
    }

    private UIElement StatusLine(string key, string label)
    {
        var grid = new Grid { Margin = new Thickness(0, 10, 0, 0) };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        grid.Children.Add(Text(label, 12, Ink, FontWeights.SemiBold, "Segoe UI"));
        var value = Text("ПРОВЕРКА", 9, Muted, FontWeights.Bold, "Consolas");
        values[key] = value;
        Grid.SetColumn(value, 1);
        grid.Children.Add(value);
        return grid;
    }

    private async Task RefreshDashboard()
    {
        if (loading) return;
        loading = true;
        try
        {
            var raw = await Task.Run(delegate { return Api("GET", "/api/dashboard", null); });
            var data = json.DeserializeObject(raw) as Dictionary<string, object>;
            RenderDashboard(data);
        }
        catch (Exception error)
        {
            SetOffline(error.Message);
        }
        finally { loading = false; }
    }

    private void RenderDashboard(Dictionary<string, object> data)
    {
        var service = Map(data, "service");
        var database = Map(data, "database");
        var chain = Map(data, "chain");
        var settings = Map(data, "settings");
        var creatorAccount = Map(data, "creatorAccount");
        statusLamp.Background = Cyan;
        statusLamp.Effect = new System.Windows.Media.Effects.DropShadowEffect { Color = Colors.Cyan, BlurRadius = 14, ShadowDepth = 0, Opacity = .7 };
        statusText.Text = "СИСТЕМА В НОРМЕ  /  PID " + Val(service, "pid", "—");
        values["uptime"].Text = FormatUptime(Number(service, "uptimeSeconds"));
        values["users"].Text = Val(database, "usersTotal", "0");
        values["sessions"].Text = Val(database, "activeSessions", "0");
        values["votes"].Text = Val(database, "votes24h", "0");
        values["memory"].Text = FormatBytes(Number(Map(service, "memory"), "rss"));
        values["db"].Text = FormatBytes(Number(database, "dbBytes"));
        values["aptos"].Text = Bool(chain, "ok") && Bool(chain, "sourceParityVerified") ? "ПРОВЕРЕН" : "ВНИМАНИЕ";
        values["aptos"].Foreground = Bool(chain, "ok") && Bool(chain, "sourceParityVerified") ? Cyan : Red;
        values["mail"].Text = Bool(settings, "emailDeliveryConfigured") ? "НАСТРОЕНА" : "НЕ НАСТРОЕНА";
        values["mail"].Foreground = Bool(settings, "emailDeliveryConfigured") ? Cyan : Gold;
        protectedCreatorEmail = Val(creatorAccount, "email", Val(settings, "superAdminEmail", protectedCreatorEmail));
        protectedCreatorAddress = Val(creatorAccount, "creatorAddress", protectedCreatorAddress);
        values["creator"].Text = Bool(creatorAccount, "configured") ? (Bool(creatorAccount, "googleLinked") ? "ГОТОВ / GOOGLE" : "ГОТОВ / БЕЗ GOOGLE") : "ТРЕБУЕТ НАСТРОЙКИ";
        values["creator"].Foreground = Bool(creatorAccount, "configured") ? Cyan : Gold;
        values["relayer"].Text = Val(chain, "relayerBalanceApt", "0") + " APT";
        if (!settingsDirty)
        {
            registration.IsChecked = Bool(settings, "registrationOpen");
            sponsorship.IsChecked = Bool(settings, "sponsorshipEnabled");
            maintenance.IsChecked = Bool(settings, "maintenanceMode");
            voteLimit.Text = Val(settings, "maxSponsoredVotesPerHour", "20");
            globalVoteLimit.Text = Val(settings, "maxSponsoredVotesGlobalPerHour", "250");
        }
        sponsorship.IsEnabled = !Bool(settings, "sponsorshipLocked");
        sponsorship.ToolTip = sponsorship.IsEnabled ? null : "Спонсирование заблокировано до воспроизводимой сборки Move-контрактов.";
        eventText.Text = FormatEvents(database.ContainsKey("recentEvents") ? database["recentEvents"] as object[] : null);
        actionText.Text = "Синхронизация " + DateTime.Now.ToString("HH:mm:ss") + "  /  loopback 4177";
    }

    private void SetOffline(string message)
    {
        statusLamp.Background = Red;
        statusLamp.Effect = null;
        statusText.Text = "СЕРВИС НЕДОСТУПЕН";
        actionText.Text = "Нет связи: " + message;
    }

    private void MarkSettingsDirty(object sender, RoutedEventArgs args)
    {
        if (loading) return;
        settingsDirty = true;
        actionText.Text = "Есть несохранённые настройки.";
    }

    private void MarkSettingsTextDirty(object sender, TextChangedEventArgs args)
    {
        MarkSettingsDirty(sender, args);
    }

    private async Task SaveSettings()
    {
        int limit;
        if (!Int32.TryParse(voteLimit.Text, out limit) || limit < 1 || limit > 500) { actionText.Text = "Лимит должен быть от 1 до 500."; return; }
        int globalLimit;
        if (!Int32.TryParse(globalVoteLimit.Text, out globalLimit) || globalLimit < 1 || globalLimit > 10000) { actionText.Text = "Общий лимит должен быть от 1 до 10000."; return; }
        var body = new Dictionary<string, object> {
            { "registrationOpen", registration.IsChecked == true },
            { "sponsorshipEnabled", sponsorship.IsChecked == true },
            { "maintenanceMode", maintenance.IsChecked == true },
            { "maxSponsoredVotesPerHour", limit },
            { "maxSponsoredVotesGlobalPerHour", globalLimit }
        };
        try
        {
            await Task.Run(delegate { Api("PATCH", "/api/settings", json.Serialize(body)); });
            settingsDirty = false;
            actionText.Text = "Настройки сохранены.";
            await RefreshDashboard();
        }
        catch (Exception error) { actionText.Text = "Ошибка: " + error.Message; }
    }

    private void ConfigureCreatorAccount()
    {
        var dialog = new Window
        {
            Title = "Аккаунт создателя",
            Owner = this,
            Width = 590,
            Height = 550,
            MinWidth = 520,
            MinHeight = 500,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            ResizeMode = ResizeMode.NoResize,
            Background = Bg,
            Foreground = Ink,
            FontFamily = new FontFamily("Segoe UI"),
        };
        var frame = new Border { Background = Bg, BorderBrush = Red, BorderThickness = new Thickness(1), Padding = new Thickness(24) };
        var stack = new StackPanel();
        frame.Child = stack;
        dialog.Content = frame;

        stack.Children.Add(Text("ЗАЩИЩЁННЫЙ КОНТУР", 10, Red, FontWeights.Bold, "Consolas"));
        var title = Text("Аккаунт супер-администратора", 24, Ink, FontWeights.Bold, "Segoe UI");
        title.Margin = new Thickness(0, 5, 0, 8);
        stack.Children.Add(title);
        var hint = Text("Подтверждённый Google-профиль с этой почтой станет профилем владельца. Пароль и Google открывают кабинет, но действия создателя по-прежнему требуют подписи creator-кошелька. Все старые сессии будут закрыты.", 12, Muted, FontWeights.Normal, "Segoe UI");
        hint.TextWrapping = TextWrapping.Wrap;
        hint.Margin = new Thickness(0, 0, 0, 16);
        stack.Children.Add(hint);

        stack.Children.Add(Text("CREATOR ADDRESS", 9, Cyan, FontWeights.Bold, "Consolas"));
        var address = new TextBox { Text = protectedCreatorAddress, IsReadOnly = true, Height = 54, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 5, 0, 12), Padding = new Thickness(10), Background = Surface, Foreground = Cyan, BorderBrush = BorderBrush, FontFamily = new FontFamily("Consolas") };
        stack.Children.Add(address);
        stack.Children.Add(Text("ПОДТВЕРЖДЁННАЯ ПОЧТА", 9, Muted, FontWeights.Bold, "Consolas"));
        var email = new TextBox { Text = protectedCreatorEmail, IsReadOnly = true, Height = 40, Margin = new Thickness(0, 5, 0, 12), Padding = new Thickness(10, 7, 10, 7), Background = Surface, Foreground = Ink, BorderBrush = BorderBrush };
        stack.Children.Add(email);

        var passwords = new Grid();
        passwords.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        passwords.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(12) });
        passwords.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var firstStack = new StackPanel();
        firstStack.Children.Add(Text("ПАРОЛЬ, МИНИМУМ 12 СИМВОЛОВ", 9, Muted, FontWeights.Bold, "Consolas"));
        var password = new PasswordBox { Height = 40, MaxLength = 128, Margin = new Thickness(0, 5, 0, 0), Padding = new Thickness(10, 7, 10, 7), Background = Surface, Foreground = Ink, BorderBrush = BorderBrush };
        firstStack.Children.Add(password);
        passwords.Children.Add(firstStack);
        var secondStack = new StackPanel();
        secondStack.Children.Add(Text("ПОВТОРИТЕ ПАРОЛЬ", 9, Muted, FontWeights.Bold, "Consolas"));
        var confirmation = new PasswordBox { Height = 40, MaxLength = 128, Margin = new Thickness(0, 5, 0, 0), Padding = new Thickness(10, 7, 10, 7), Background = Surface, Foreground = Ink, BorderBrush = BorderBrush };
        secondStack.Children.Add(confirmation);
        Grid.SetColumn(secondStack, 2);
        passwords.Children.Add(secondStack);
        stack.Children.Add(passwords);

        var message = Text("Пароль хешируется scrypt и не сохраняется в открытом виде.", 10, Muted, FontWeights.Normal, "Segoe UI");
        message.Margin = new Thickness(0, 12, 0, 0);
        message.TextWrapping = TextWrapping.Wrap;
        stack.Children.Add(message);
        var actions = new Grid { Margin = new Thickness(0, 12, 0, 0) };
        actions.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        actions.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(12) });
        actions.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var cancel = ActionButton("ОТМЕНА", delegate { dialog.Close(); }, true);
        actions.Children.Add(cancel);
        Button submit = null;
        submit = ActionButton("СОЗДАТЬ / ОБНОВИТЬ", async delegate
        {
            if (password.Password.Length < 12) { message.Text = "Пароль должен содержать не менее 12 символов."; message.Foreground = Red; return; }
            if (password.Password != confirmation.Password) { message.Text = "Пароли не совпадают."; message.Foreground = Red; return; }
            submit.IsEnabled = false;
            message.Text = "Транзакция PostgreSQL выполняется…";
            message.Foreground = Cyan;
            try
            {
                var body = new Dictionary<string, object> {
                    { "password", password.Password }
                };
                await Task.Run(delegate { Api("POST", "/api/creator-account/bootstrap", json.Serialize(body)); });
                password.Clear();
                confirmation.Clear();
                actionText.Text = "Аккаунт создателя настроен. Старые сессии закрыты.";
                dialog.Close();
                await RefreshDashboard();
            }
            catch (Exception error)
            {
                password.Clear();
                confirmation.Clear();
                submit.IsEnabled = true;
                message.Text = "Ошибка: " + error.Message;
                message.Foreground = Red;
            }
        }, false);
        Grid.SetColumn(submit, 2);
        actions.Children.Add(submit);
        stack.Children.Add(actions);
        dialog.ShowDialog();
    }

    private async Task PostAction(string path)
    {
        try
        {
            actionText.Text = "Команда выполняется…";
            await Task.Run(delegate { Api("POST", path, "{}"); });
            actionText.Text = "Команда принята.";
        }
        catch (Exception error) { actionText.Text = "Ошибка: " + error.Message; }
    }

    private void StartService()
    {
        if (IsHealthy()) { actionText.Text = "Сервис уже работает."; return; }
        var launcher = Path.Combine(root, "Start-Sovet-Online.exe");
        if (!File.Exists(launcher)) { actionText.Text = "Не найден Start-Sovet-Online.exe."; return; }
        Process.Start(new ProcessStartInfo { FileName = launcher, WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
        actionText.Text = "Запуск сервиса…";
    }

    private void ConfigureMail()
    {
        var script = Path.Combine(root, "server", "Setup-Mail.ps1");
        if (!File.Exists(script)) { actionText.Text = "Не найден мастер настройки почты."; return; }
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"",
                WorkingDirectory = root,
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Normal,
            });
            actionText.Text = "Мастер почты открыт. После проверки перезапустите сервис.";
        }
        catch (Exception error) { actionText.Text = "Не удалось открыть мастер почты: " + error.Message; }
    }

    private async Task DelayRefresh()
    {
        await Task.Delay(3500);
        await RefreshDashboard();
    }

    private string Api(string method, string path, string body)
    {
        if (!File.Exists(operatorKeyPath)) throw new InvalidOperationException("Ключ оператора ещё не создан. Сначала запустите сайт один раз.");
        var request = (HttpWebRequest)WebRequest.Create(ApiRoot + path);
        request.Method = method;
        request.Timeout = 7000;
        request.ReadWriteTimeout = 7000;
        request.Headers["X-Sovet-Operator-Key"] = File.ReadAllText(operatorKeyPath).Trim();
        request.ContentType = "application/json";
        if (body != null)
        {
            var bytes = Encoding.UTF8.GetBytes(body);
            request.ContentLength = bytes.Length;
            using (var stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
        }
        try
        {
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8)) return reader.ReadToEnd();
        }
        catch (WebException error)
        {
            var response = error.Response as HttpWebResponse;
            if (response == null) throw;
            using (response)
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8)) throw new InvalidOperationException(reader.ReadToEnd());
        }
    }

    private static bool IsHealthy()
    {
        try { using (var response = WebRequest.Create(HealthUrl).GetResponse()) return true; }
        catch { return false; }
    }

    private static Dictionary<string, object> Map(Dictionary<string, object> source, string key)
    {
        object value;
        return source != null && source.TryGetValue(key, out value) ? value as Dictionary<string, object> ?? new Dictionary<string, object>() : new Dictionary<string, object>();
    }

    private static string Val(Dictionary<string, object> source, string key, string fallback)
    {
        object value;
        return source != null && source.TryGetValue(key, out value) && value != null ? Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) : fallback;
    }

    private static long Number(Dictionary<string, object> source, string key)
    {
        long value;
        return Int64.TryParse(Val(source, key, "0"), out value) ? value : 0;
    }

    private static bool Bool(Dictionary<string, object> source, string key)
    {
        bool value;
        return Boolean.TryParse(Val(source, key, "false"), out value) && value;
    }

    private static string FormatBytes(long value)
    {
        if (value < 1024 * 1024) return Math.Max(0, value / 1024) + " КБ";
        return (value / 1024d / 1024d).ToString("0.0") + " МБ";
    }

    private static string FormatUptime(long seconds)
    {
        var span = TimeSpan.FromSeconds(Math.Max(0, seconds));
        return span.Days > 0 ? span.Days + " Д " + span.Hours + " Ч" : span.Hours > 0 ? span.Hours + " Ч " + span.Minutes + " М" : span.Minutes + " МИН";
    }

    private static string FormatEvents(object[] events)
    {
        if (events == null || events.Length == 0) return "Событий пока нет.";
        var lines = new List<string>();
        for (var i = 0; i < Math.Min(6, events.Length); i++)
        {
            var item = events[i] as Dictionary<string, object>;
            if (item == null) continue;
            lines.Add("› " + Val(item, "kind", "event").ToUpperInvariant() + "  " + Val(item, "message", "—"));
        }
        return String.Join(Environment.NewLine + Environment.NewLine, lines.ToArray());
    }

    private static Border Card() { return Card(new Thickness(0)); }
    private static Border Card(Thickness margin)
    {
        return new Border { Background = Surface, BorderBrush = BorderBrush, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(6), Margin = margin };
    }

    private static TextBlock Text(string value, double size, Brush color, FontWeight weight, string family)
    {
        return new TextBlock { Text = value, FontSize = size, Foreground = color, FontWeight = weight, FontFamily = new FontFamily(family), VerticalAlignment = VerticalAlignment.Center };
    }

    private static CheckBox Toggle(string label)
    {
        return new CheckBox { Content = label, Foreground = Ink, FontSize = 12, MinHeight = 34, VerticalContentAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 6, 0, 0) };
    }

    private static Button ActionButton(string label, RoutedEventHandler action, bool danger)
    {
        var button = new Button { Content = label, MinHeight = 40, Margin = new Thickness(0, 9, 0, 0), Padding = new Thickness(12, 7, 12, 7), Background = danger ? Brush("#311512") : Surface2, Foreground = danger ? Red : Ink, BorderBrush = danger ? Red : BorderBrush, BorderThickness = new Thickness(1), FontFamily = new FontFamily("Consolas"), FontWeight = FontWeights.Bold, FontSize = 11, Cursor = Cursors.Hand };
        button.Click += action;
        return button;
    }

    private static Button WindowButton(string label, RoutedEventHandler action)
    {
        var button = new Button { Content = label, Width = 42, Height = 42, Margin = new Thickness(6, 0, 0, 0), Background = Brushes.Transparent, Foreground = Ink, BorderBrush = BorderBrush, FontSize = 18, Cursor = Cursors.Hand };
        button.Click += action;
        return button;
    }

    private static Brush Brush(string value) { return (Brush)new BrushConverter().ConvertFromString(value); }
    private static void OpenUrl(string url) { try { Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true }); } catch { } }
}
