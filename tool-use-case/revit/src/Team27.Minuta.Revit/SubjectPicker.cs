using System.Windows;
using System.Windows.Controls;
using Team27.Minuta.Core;

namespace Team27.Minuta.Revit;

internal sealed class SubjectPicker : Window
{
    private readonly ListBox list;

    public SubjectPicker(IReadOnlyList<SubjectInfo> subjects, int count)
    {
        Title = "Vincular a la obra";
        Width = 400;
        SizeToContent = SizeToContent.Height;
        ResizeMode = ResizeMode.NoResize;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        ShowInTaskbar = false;

        var root = new StackPanel { Margin = new Thickness(16) };
        root.Children.Add(new TextBlock
        {
            Text = count == 1
                ? "¿A qué elemento de la obra corresponde el elemento seleccionado?"
                : $"¿A qué elemento de la obra corresponden los {count} elementos seleccionados?",
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 8),
        });

        list = new ListBox { Height = 220 };
        foreach (var subject in subjects)
        {
            list.Items.Add(new ListBoxItem { Content = $"{subject.Name} ({subject.Id})", Tag = subject.Id });
        }
        list.Items.Add(new ListBoxItem { Content = "Quitar el vínculo", Tag = string.Empty });
        list.SelectedIndex = 0;
        list.MouseDoubleClick += (_, _) => Accept();
        root.Children.Add(list);

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 12, 0, 0),
        };
        var accept = new Button { Content = "Vincular", IsDefault = true, MinWidth = 96, Margin = new Thickness(0, 0, 8, 0) };
        accept.Click += (_, _) => Accept();
        buttons.Children.Add(accept);
        buttons.Children.Add(new Button { Content = "Cancelar", IsCancel = true, MinWidth = 96 });
        root.Children.Add(buttons);

        Content = root;
    }

    public string? SelectedKey { get; private set; }

    private void Accept()
    {
        if (list.SelectedItem is ListBoxItem { Tag: string key })
        {
            SelectedKey = key;
            DialogResult = true;
        }
    }
}
