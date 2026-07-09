using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace MacroRecorder
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    public partial class MainForm : Form
    {
        // --- Win32 API imports ---
        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
        private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [DllImport("user32.dll")]
        private static extern bool SetCursorPos(int x, int y);

        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern short VkKeyScanEx(char ch, IntPtr dwhkl);

        [DllImport("user32.dll")]
        private static extern IntPtr GetKeyboardLayout(uint idThread);

        // --- Constants ---
        private const int WH_KEYBOARD_LL = 13;
        private const int WH_MOUSE_LL = 14;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_KEYUP = 0x0101;
        private const int WM_SYSKEYDOWN = 0x0104;
        private const int WM_SYSKEYUP = 0x0105;
        private const int WM_MOUSEMOVE = 0x0200;
        private const int WM_LBUTTONDOWN = 0x0201;
        private const int WM_LBUTTONUP = 0x0202;
        private const int WM_RBUTTONDOWN = 0x0204;
        private const int WM_RBUTTONUP = 0x0205;
        private const int WM_MBUTTONDOWN = 0x0207;
        private const int WM_MBUTTONUP = 0x0208;
        private const int WM_MOUSEWHEEL = 0x020A;
        private const int WM_XBUTTONDOWN = 0x020B;
        private const int WM_XBUTTONUP = 0x020C;

        private const int INPUT_MOUSE = 0;
        private const int INPUT_KEYBOARD = 1;
        private const int KEYEVENTF_KEYUP = 0x0002;
        private const int KEYEVENTF_SCANCODE = 0x0008;
        private const int MOUSEEVENTF_MOVE = 0x0001;
        private const int MOUSEEVENTF_ABSOLUTE = 0x8000;
        private const int MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const int MOUSEEVENTF_LEFTUP = 0x0004;
        private const int MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const int MOUSEEVENTF_RIGHTUP = 0x0010;
        private const int MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const int MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const int MOUSEEVENTF_WHEEL = 0x0800;
        private const int MOUSEEVENTF_XDOWN = 0x0080;
        private const int MOUSEEVENTF_XUP = 0x0100;

        // --- Structs ---
        [StructLayout(LayoutKind.Sequential)]
        private struct POINT
        {
            public int x;
            public int y;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MSLLHOOKSTRUCT
        {
            public POINT pt;
            public uint mouseData;
            public uint flags;
            public uint time;
            public UIntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KBDLLHOOKSTRUCT
        {
            public uint vkCode;
            public uint scanCode;
            public uint flags;
            public uint time;
            public UIntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public UIntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public UIntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct INPUT
        {
            [FieldOffset(0)]
            public int type;
            [FieldOffset(4)]
            public MOUSEINPUT mi;
            [FieldOffset(4)]
            public KEYBDINPUT ki;
        }

        // --- Event types ---
        private enum RecordedEventType
        {
            MouseMove,
            MouseLeftDown,
            MouseLeftUp,
            MouseRightDown,
            MouseRightUp,
            MouseMiddleDown,
            MouseMiddleUp,
            MouseXDown,
            MouseXUp,
            MouseWheel,
            KeyDown,
            KeyUp
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct RecordedEvent
        {
            public RecordedEventType Type;
            public int Param1; // x, vkCode, etc
            public int Param2; // y, scanCode, etc
            public uint Param3; // flags, mouseData, etc
            public int DelayMs;
        }

        // --- Hook instances ---
        private LowLevelKeyboardProc _keyboardProc;
        private LowLevelMouseProc _mouseProc;
        private IntPtr _keyboardHookId = IntPtr.Zero;
        private IntPtr _mouseHookId = IntPtr.Zero;

        // --- State ---
        private enum AppState { Idle, Recording, Replaying }
        private AppState _state = AppState.Idle;
        private List<RecordedEvent> _recordedEvents = new List<RecordedEvent>();
        private Stopwatch _recordStopwatch = new Stopwatch();
        private Thread _replayThread;
        private volatile bool _stopReplay = false;

        // Mouse move throttle
        private DateTime _lastMouseMoveRecord = DateTime.MinValue;
        private const int MouseMoveThrottleMs = 15;

        // --- UI Controls ---
        private Button _btnRecord;
        private Button _btnStop;
        private Button _btnReplay;
        private Label _lblStatus;
        private Label _lblEventCount;
        private Label _lblWarning;
        private Label _lblTitle;

        public MainForm()
        {
            InitializeComponent();
            _keyboardProc = KeyboardHookCallback;
            _mouseProc = MouseHookCallback;
            InstallHooks();
        }

        private void InstallHooks()
        {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                IntPtr moduleHandle = GetModuleHandle(curModule.ModuleName);
                _keyboardHookId = SetWindowsHookEx(WH_KEYBOARD_LL, _keyboardProc, moduleHandle, 0);
                _mouseHookId = SetWindowsHookEx(WH_MOUSE_LL, _mouseProc, moduleHandle, 0);
            }
        }

        private void UninstallHooks()
        {
            if (_keyboardHookId != IntPtr.Zero)
                UnhookWindowsHookEx(_keyboardHookId);
            if (_mouseHookId != IntPtr.Zero)
                UnhookWindowsHookEx(_mouseHookId);
        }

        private IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && _state == AppState.Replaying)
            {
                int vkCode = Marshal.ReadInt32(lParam);
                // ESC cancels replay
                if (vkCode == 0x1B && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN))
                {
                    _stopReplay = true;
                }
            }

            if (nCode >= 0 && _state == AppState.Recording)
            {
                KBDLLHOOKSTRUCT kbd = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
                int msg = wParam.ToInt32();

                if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
                {
                    // Don't record the hotkey key itself (optional)
                    RecordEvent(RecordedEventType.KeyDown, (int)kbd.vkCode, (int)kbd.scanCode, kbd.flags);
                }
                else if (msg == WM_KEYUP || msg == WM_SYSKEYUP)
                {
                    RecordEvent(RecordedEventType.KeyUp, (int)kbd.vkCode, (int)kbd.scanCode, kbd.flags);
                }
            }

            return CallNextHookEx(_keyboardHookId, nCode, wParam, lParam);
        }

        private IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && _state == AppState.Recording)
            {
                MSLLHOOKSTRUCT mouse = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
                int msg = wParam.ToInt32();

                switch (msg)
                {
                    case WM_MOUSEMOVE:
                        var now = DateTime.UtcNow;
                        if ((now - _lastMouseMoveRecord).TotalMilliseconds >= MouseMoveThrottleMs)
                        {
                            _lastMouseMoveRecord = now;
                            RecordEvent(RecordedEventType.MouseMove, mouse.pt.x, mouse.pt.y, 0);
                        }
                        break;
                    case WM_LBUTTONDOWN:
                        RecordEvent(RecordedEventType.MouseLeftDown, mouse.pt.x, mouse.pt.y, 0);
                        break;
                    case WM_LBUTTONUP:
                        RecordEvent(RecordedEventType.MouseLeftUp, mouse.pt.x, mouse.pt.y, 0);
                        break;
                    case WM_RBUTTONDOWN:
                        RecordEvent(RecordedEventType.MouseRightDown, mouse.pt.x, mouse.pt.y, 0);
                        break;
                    case WM_RBUTTONUP:
                        RecordEvent(RecordedEventType.MouseRightUp, mouse.pt.x, mouse.pt.y, 0);
                        break;
                    case WM_MBUTTONDOWN:
                        RecordEvent(RecordedEventType.MouseMiddleDown, mouse.pt.x, mouse.pt.y, 0);
                        break;
                    case WM_MBUTTONUP:
                        RecordEvent(RecordedEventType.MouseMiddleUp, mouse.pt.x, mouse.pt.y, 0);
                        break;
                    case WM_MOUSEWHEEL:
                        RecordEvent(RecordedEventType.MouseWheel, mouse.pt.x, mouse.pt.y, mouse.mouseData);
                        break;
                    case WM_XBUTTONDOWN:
                        RecordEvent(RecordedEventType.MouseXDown, mouse.pt.x, mouse.pt.y, mouse.mouseData);
                        break;
                    case WM_XBUTTONUP:
                        RecordEvent(RecordedEventType.MouseXUp, mouse.pt.x, mouse.pt.y, mouse.mouseData);
                        break;
                }
            }

            return CallNextHookEx(_mouseHookId, nCode, wParam, lParam);
        }

        private void RecordEvent(RecordedEventType type, int param1, int param2, uint param3)
        {
            var evt = new RecordedEvent
            {
                Type = type,
                Param1 = param1,
                Param2 = param2,
                Param3 = param3,
                DelayMs = (int)_recordStopwatch.ElapsedMilliseconds
            };
            _recordedEvents.Add(evt);
        }

        private void StartRecording()
        {
            _recordedEvents.Clear();
            _recordStopwatch.Reset();
            _recordStopwatch.Start();
            _lastMouseMoveRecord = DateTime.UtcNow;
            _state = AppState.Recording;

            UpdateUI();
        }

        private void StopRecording()
        {
            if (_state == AppState.Recording)
            {
                _recordStopwatch.Stop();
                _state = AppState.Idle;
                UpdateUI();
            }
        }

        private void StartReplay()
        {
            if (_recordedEvents.Count == 0)
            {
                MessageBox.Show("No recorded events to replay.", "Macro Recorder", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            _state = AppState.Replaying;
            _stopReplay = false;
            UpdateUI();

            _replayThread = new Thread(ReplayThreadFunc);
            _replayThread.IsBackground = true;
            _replayThread.Start();
        }

        private void ReplayThreadFunc()
        {
            try
            {
                // Take a snapshot of events
                var events = new List<RecordedEvent>(_recordedEvents);
                var sw = Stopwatch.StartNew();
                int eventIndex = 0;
                int baseDelay = events[0].DelayMs;

                while (eventIndex < events.Count && !_stopReplay)
                {
                    var evt = events[eventIndex];
                    int targetDelay = evt.DelayMs - baseDelay;
                    int currentElapsed = (int)sw.ElapsedMilliseconds;

                    int waitTime = targetDelay - currentElapsed;
                    if (waitTime > 0)
                    {
                        Thread.Sleep(waitTime);
                    }

                    if (_stopReplay)
                        break;

                    // Execute the event
                    ExecuteEvent(evt);

                    // Update UI periodically
                    if (eventIndex % 10 == 0)
                    {
                        this.Invoke((MethodInvoker)delegate
                        {
                            _lblEventCount.Text = string.Format("Event: {0}/{1}", eventIndex + 1, events.Count);
                        });
                    }

                    eventIndex++;
                }

                sw.Stop();
            }
            catch (Exception ex)
            {
                this.Invoke((MethodInvoker)delegate
                {
                    MessageBox.Show("Replay error: " + ex.Message, "Macro Recorder", MessageBoxButtons.OK, MessageBoxIcon.Error);
                });
            }
            finally
            {
                _state = AppState.Idle;
                this.Invoke((MethodInvoker)delegate { UpdateUI(); });
            }
        }

        private void ExecuteEvent(RecordedEvent evt)
        {
            switch (evt.Type)
            {
                case RecordedEventType.MouseMove:
                    SetCursorPos(evt.Param1, evt.Param2);
                    break;

                case RecordedEventType.MouseLeftDown:
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    break;
                case RecordedEventType.MouseLeftUp:
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    break;
                case RecordedEventType.MouseRightDown:
                    mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                    break;
                case RecordedEventType.MouseRightUp:
                    mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                    break;
                case RecordedEventType.MouseMiddleDown:
                    mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, UIntPtr.Zero);
                    break;
                case RecordedEventType.MouseMiddleUp:
                    mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, UIntPtr.Zero);
                    break;
                case RecordedEventType.MouseWheel:
                    int delta = (short)((evt.Param3 >> 16) & 0xFFFF);
                    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
                    break;
                case RecordedEventType.MouseXDown:
                    mouse_event(MOUSEEVENTF_XDOWN, 0, 0, (evt.Param3 >> 16) & 0xFFFF, UIntPtr.Zero);
                    break;
                case RecordedEventType.MouseXUp:
                    mouse_event(MOUSEEVENTF_XUP, 0, 0, (evt.Param3 >> 16) & 0xFFFF, UIntPtr.Zero);
                    break;

                case RecordedEventType.KeyDown:
                    SendKey((ushort)evt.Param1, false);
                    break;
                case RecordedEventType.KeyUp:
                    SendKey((ushort)evt.Param1, true);
                    break;
            }
        }

        private void SendKey(ushort vkCode, bool keyUp)
        {
            INPUT[] inputs = new INPUT[1];
            inputs[0] = new INPUT();
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].ki.wVk = vkCode;
            inputs[0].ki.wScan = 0;
            inputs[0].ki.dwFlags = keyUp ? KEYEVENTF_KEYUP : (uint)0;
            inputs[0].ki.time = 0;
            inputs[0].ki.dwExtraInfo = UIntPtr.Zero;
            SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        private void UpdateUI()
        {
            bool isIdle = _state == AppState.Idle;
            bool isRecording = _state == AppState.Recording;
            bool isReplaying = _state == AppState.Replaying;

            _btnRecord.Enabled = isIdle;
            _btnStop.Enabled = isRecording || isReplaying;
            _btnReplay.Enabled = isIdle && _recordedEvents.Count > 0;

            switch (_state)
            {
                case AppState.Idle:
                    _lblStatus.Text = "PRONTO (Idle)";
                    _lblStatus.BackColor = Color.Gray;
                    _lblEventCount.Text = _recordedEvents.Count > 0
                        ? string.Format("Events recorded: {0}", _recordedEvents.Count)
                        : "No events recorded";
                    this.Text = "Macro Recorder [IDLE]";
                    break;
                case AppState.Recording:
                    _lblStatus.Text = "RECORDING...";
                    _lblStatus.BackColor = Color.Red;
                    _lblEventCount.Text = string.Format("Recording: {0} events", _recordedEvents.Count);
                    this.Text = "Macro Recorder [RECORDING]";
                    break;
                case AppState.Replaying:
                    _lblStatus.Text = "REPLAYING... (Press ESC to cancel)";
                    _lblStatus.BackColor = Color.Green;
                    this.Text = "Macro Recorder [REPLAYING]";
                    break;
            }
        }

        // --- Prevent hiding the window ---
        protected override void SetVisibleCore(bool value)
        {
            // Never allow the form to become invisible
            base.SetVisibleCore(true);
        }

        protected override void WndProc(ref Message m)
        {
            const int WM_SYSCOMMAND = 0x0112;
            const int SC_MINIMIZE = 0xF020;
            const int SC_RESTORE = 0xF120;

            if (m.Msg == WM_SYSCOMMAND)
            {
                int cmd = m.WParam.ToInt32() & 0xFFF0;
                if (cmd == SC_MINIMIZE)
                {
                    // Allow minimize but ensure it stays in taskbar
                    base.WndProc(ref m);
                    return;
                }
            }

            base.WndProc(ref m);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (_state == AppState.Recording || _state == AppState.Replaying)
            {
                var result = MessageBox.Show(
                    "Recording/Replaying is in progress. Do you really want to exit?",
                    "Macro Recorder",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);
                if (result == DialogResult.No)
                {
                    e.Cancel = true;
                    return;
                }

                // Stop any ongoing operation
                _stopReplay = true;
                _state = AppState.Idle;
            }

            UninstallHooks();
            base.OnFormClosing(e);
        }

        // --- Button handlers ---
        private void BtnRecord_Click(object sender, EventArgs e)
        {
            StartRecording();
        }

        private void BtnStop_Click(object sender, EventArgs e)
        {
            if (_state == AppState.Recording)
            {
                StopRecording();
            }
            else if (_state == AppState.Replaying)
            {
                _stopReplay = true;
            }
        }

        private void BtnReplay_Click(object sender, EventArgs e)
        {
            StartReplay();
        }

        // --- Window setup ---
        private void InitializeComponent()
        {
            this.Text = "Macro Recorder [IDLE]";
            this.Size = new Size(520, 300);
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.TopMost = true;
            this.ShowInTaskbar = true;
            this.BackColor = Color.FromArgb(30, 30, 30);
            this.ForeColor = Color.White;
            this.Font = new Font("Segoe UI", 10, FontStyle.Regular);

            // Title
            _lblTitle = new Label
            {
                Text = "MACRO RECORDER - Visible Recording Tool",
                Location = new Point(10, 10),
                Size = new Size(480, 25),
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                ForeColor = Color.FromArgb(255, 200, 50),
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(_lblTitle);

            // Status
            _lblStatus = new Label
            {
                Text = "PRONTO (Idle)",
                Location = new Point(10, 45),
                Size = new Size(480, 35),
                Font = new Font("Segoe UI", 14, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.Gray,
                TextAlign = ContentAlignment.MiddleCenter,
                FlatStyle = FlatStyle.Flat,
                BorderStyle = BorderStyle.FixedSingle
            };
            this.Controls.Add(_lblStatus);

            // Warning label
            _lblWarning = new Label
            {
                Text = "⚠ This application is ALWAYS VISIBLE. It CANNOT run in the background.\n" +
                       "It is designed for transparency and ethical use only.",
                Location = new Point(10, 90),
                Size = new Size(480, 40),
                Font = new Font("Segoe UI", 8, FontStyle.Italic),
                ForeColor = Color.FromArgb(255, 150, 150),
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(_lblWarning);

            // Event count
            _lblEventCount = new Label
            {
                Text = "No events recorded",
                Location = new Point(10, 135),
                Size = new Size(480, 20),
                Font = new Font("Segoe UI", 9, FontStyle.Regular),
                ForeColor = Color.LightGray,
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(_lblEventCount);

            // Buttons
            _btnRecord = new Button
            {
                Text = "● Record",
                Location = new Point(70, 170),
                Size = new Size(110, 40),
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.FromArgb(200, 50, 50),
                FlatStyle = FlatStyle.Flat,
                FlatAppearance = { BorderColor = Color.DarkRed, BorderSize = 1 },
                Cursor = Cursors.Hand
            };
            _btnRecord.Click += BtnRecord_Click;
            _btnRecord.MouseEnter += (s, e) => _btnRecord.BackColor = Color.FromArgb(230, 70, 70);
            _btnRecord.MouseLeave += (s, e) => _btnRecord.BackColor = Color.FromArgb(200, 50, 50);
            this.Controls.Add(_btnRecord);

            _btnStop = new Button
            {
                Text = "■ Stop",
                Location = new Point(200, 170),
                Size = new Size(110, 40),
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.FromArgb(80, 80, 80),
                FlatStyle = FlatStyle.Flat,
                FlatAppearance = { BorderColor = Color.DimGray, BorderSize = 1 },
                Enabled = false,
                Cursor = Cursors.Hand
            };
            _btnStop.Click += BtnStop_Click;
            _btnStop.MouseEnter += (s, e) => _btnStop.BackColor = Color.FromArgb(110, 110, 110);
            _btnStop.MouseLeave += (s, e) => _btnStop.BackColor = Color.FromArgb(80, 80, 80);
            this.Controls.Add(_btnStop);

            _btnReplay = new Button
            {
                Text = "► Replay",
                Location = new Point(330, 170),
                Size = new Size(110, 40),
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.FromArgb(50, 130, 50),
                FlatStyle = FlatStyle.Flat,
                FlatAppearance = { BorderColor = Color.DarkGreen, BorderSize = 1 },
                Enabled = false,
                Cursor = Cursors.Hand
            };
            _btnReplay.Click += BtnReplay_Click;
            _btnReplay.MouseEnter += (s, e) => _btnReplay.BackColor = Color.FromArgb(70, 160, 70);
            _btnReplay.MouseLeave += (s, e) => _btnReplay.BackColor = Color.FromArgb(50, 130, 50);
            this.Controls.Add(_btnReplay);

            // Footer
            var footer = new Label
            {
                Text = "ESC cancels replay | This window stays visible at all times",
                Location = new Point(10, 225),
                Size = new Size(480, 20),
                Font = new Font("Segoe UI", 8, FontStyle.Italic),
                ForeColor = Color.Gray,
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(footer);

            // Key info
            var hotkeyLabel = new Label
            {
                Text = "Hotkeys: [Ctrl+Shift+R] Record | [Ctrl+Shift+S] Stop | [Ctrl+Shift+P] Replay",
                Location = new Point(10, 245),
                Size = new Size(480, 16),
                Font = new Font("Segoe UI", 7, FontStyle.Regular),
                ForeColor = Color.DimGray,
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(hotkeyLabel);
        }

        // --- Global hotkeys ---
        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == (Keys.Control | Keys.Shift | Keys.R))
            {
                if (_state == AppState.Idle)
                    StartRecording();
                return true;
            }
            if (keyData == (Keys.Control | Keys.Shift | Keys.S))
            {
                if (_state == AppState.Recording)
                    StopRecording();
                else if (_state == AppState.Replaying)
                    _stopReplay = true;
                return true;
            }
            if (keyData == (Keys.Control | Keys.Shift | Keys.P))
            {
                if (_state == AppState.Idle)
                    StartReplay();
                return true;
            }

            return base.ProcessCmdKey(ref msg, keyData);
        }
    }
}
