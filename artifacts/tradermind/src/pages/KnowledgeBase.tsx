<RuleItem key={n.id} n={n} />)}</div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">سایر قوانین</h3>
          <div className="space-y-2">{rest.map(n => <RuleItem key={n.id} n={n} />)}</div>
        </div>
      )}
    </div>
  );
}

// ── Timeline Tab ───────────────────────────────────────────────────

function TimelineTab({ notes }: { notes: KnowledgeNote[] }) {
  const grouped = useMemo(() => {
    const byMonth: Record<string, KnowledgeNote[]> = {};
    for (const n of [...notes].sort((a, b) => b.createdAt - a.createdAt)) {
      const date = new Date(n.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(n);
    }
    return byMonth;
  }, [notes]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const months = ['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" dir="rtl">
        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>تایم‌لاینی موجود نیست</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {Object.entries(grouped).map(([month, mnotes]) => (
        <div key={month}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />{monthLabel(month)}
            <span className="text-[10px] bg-muted/60 rounded-full px-1.5">{mnotes.length}</span>
          </h3>
          <div className="space-y-2 relative">
            <div className="absolute right-[7px] top-0 bottom-0 w-px bg-border/60" />
            {mnotes.map(n => {
              const imp = IMPORTANCE_CONFIG[n.importance] || IMPORTANCE_CONFIG.medium;
              const ImpIcon = imp.icon;
              return (
                <div key={n.id} className="flex gap-3 pr-5 relative">
                  <div className={`absolute right-0 top-2.5 w-3.5 h-3.5 rounded-full border-2 border-background flex items-center justify-center`} style={{ backgroundColor: n.color }}>
                  </div>
                  <div className="flex-1 rounded-lg border border-border/40 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium flex-1 truncate">{n.title}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <ImpIcon className={`h-3.5 w-3.5 ${imp.color}`} />
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleDateString('fa-IR')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SOURCE_LABELS[n.source]?.color}`}>
                        {SOURCE_LABELS[n.source]?.label}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_CONFIG[n.status]?.color}`}>
                        {STATUS_CONFIG[n.status]?.label}
                      </Badge>
                      {n.reviewCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">{n.reviewCount}× مرور</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stats Tab ──────────────────────────────────────────────────────

function StatsTab({ stats, categories }: {
  stats: Awaited<ReturnType<typeof knowledgeService.getStats>> | null;
  categories: KnowledgeCategory[];
}) {
  if (!stats) return <div className="text-center py-12 text-muted-foreground">در حال بارگذاری...</div>;

  const catMap: Record<string, KnowledgeCategory> = {};
  categories.forEach(c => { catMap[c.id] = c; });

  const impColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280' };
  const impLabels: Record<string, string> = { critical: 'حیاتی', high: 'بالا', medium: 'متوسط', low: 'پایین' };

  return (
    <div className="space-y-4" dir="rtl">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'کل یادداشت‌ها', value: stats.total, icon: BookOpen, color: 'text-blue-400' },
          { label: 'قوانین فعال', value: stats.rules, icon: Shield, color: 'text-green-400' },
          { label: 'بینش‌های AI', value: stats.aiInsights, icon: Sparkles, color: 'text-purple-400' },
          { label: 'منسوخ شده', value: stats.outdated, icon: XCircle, color: 'text-gray-400' },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-3">
              <item.icon className={`h-5 w-5 ${item.color} mb-2`} />
              <p className="text-xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By importance */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">بر اساس اهمیت</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(Object.entries(stats.byImportance) as [NoteImportance, number][]).sort((a, b) => {
              const order: NoteImportance[] = ['critical', 'high', 'medium', 'low'];
              return order.indexOf(a[0]) - order.indexOf(b[0]);
            }).map(([imp, count]) => (
              <div key={imp} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: impColors[imp] }} />
                <span className="text-xs text-muted-foreground w-16">{impLabels[imp]}</span>
                <div className="flex-1 bg-muted/40 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full" style={{ width: `${stats.active > 0 ? (count / stats.active) * 100 : 0}%`, backgroundColor: impColors[imp] }} />
                </div>
                <span className="text-xs font-medium w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* By category */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">بر اساس دسته‌بندی</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {Object.entries(stats.byCat)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([catId, count]) => {
                const cat = catMap[catId];
                return (
                  <div key={catId} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{cat ? `${cat.icon} ${cat.name}` : catId}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted/40 rounded-full h-1">
                        <div className="h-1 rounded-full bg-primary/60" style={{ width: `${stats.active > 0 ? (count / stats.active) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs font-medium w-4 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Most reviewed */}
      {stats.mostReviewed.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><TrendingUp className="h-4 w-4 text-primary" /> بیشترین مرور</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.mostReviewed.map(n => (
                <div key={n.id} className="flex items-center justify-between">
                  <p className="text-xs truncate flex-1">{n.title}</p>
                  <span className="text-xs text-primary font-medium shrink-0 ml-2">{n.reviewCount}×</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI insights status */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Sparkles className="h-4 w-4 text-purple-400" /> وضعیت بینش‌های AI</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-purple-400">{stats.aiInsights}</p>
              <p className="text-[11px] text-muted-foreground">کل</p>
            </div>
            <div>
              <p className="text-xl font-bold text-green-400">{stats.aiConfirmed}</p>
              <p className="text-[11px] text-muted-foreground">تأیید شده</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-400">{stats.neverReviewed}</p>
              <p className="text-[11px] text-muted-foreground">مرور نشده</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Checklist Tab ──────────────────────────────────────────────────

const ITEM_PRIORITY_COLORS: Record<NoteImportance, string> = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-yellow-400',
  low:      'text-gray-400',
};

function ChecklistTab({ notes }: { notes: KnowledgeNote[] }) {
  const [checklists, setChecklists] = useState<PreTradeChecklist[]>([]);
  const [selected, setSelected]     = useState<PreTradeChecklist | null>(null);
  const [useMode, setUseMode]       = useState(false);
  const [checked, setChecked]       = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [showEditCL, setShowEditCL] = useState(false);
  const [editItem, setEditItem]     = useState<ChecklistItemDef | null>(null);
  const [newItemText, setNewItemText]    = useState('');
  const [newItemPrio, setNewItemPrio]    = useState<NoteImportance>('medium');
  const [newItemNote, setNewItemNote]    = useState('');
  const [newCLName, setNewCLName]        = useState('');
  const [newCLSymbol, setNewCLSymbol]    = useState('');
  const [newCLSession, setNewCLSession]  = useState('');
  const [newCLSetup, setNewCLSetup]      = useState('');
  const [dragIdx, setDragIdx]            = useState<number | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    await checklistService.ensureDefaultChecklist();
    const list = await checklistService.getAllChecklists();
    setChecklists(list);
    if (!selected && list.length > 0) {
      setSelected(list.find(c => c.isDefault) ?? list[0]);
    } else if (selected) {
      // refresh selected
      const fresh = list.find(c => c.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [selected]);

  useEffect(() => { load(); }, []);

  const items = useMemo(
    () => selected ? checklistService.parseItems(selected.items) : [],
    [selected]
  );

  const noteMap = useMemo(() => {
    const m: Record<string, KnowledgeNote> = {};
    notes.forEach(n => { m[n.id] = n; });
    return m;
  }, [notes]);

  const handleAddItem = async () => {
    if (!selected || !newItemText.trim()) return;
    await checklistService.addItem(
      selected.id, newItemText.trim(), newItemPrio,
      newItemNote || null
    );
    setNewItemText(''); setNewItemPrio('medium'); setNewItemNote('');
    load();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selected) return;
    await checklistService.deleteItem(selected.id, itemId);
    load();
    toast({ title: 'آیتم حذف شد' });
  };

  const handleUpdateItem = async (updated: ChecklistItemDef) => {
    if (!selected) return;
    await checklistService.updateItem(selected.id, updated.id, updated);
    setEditItem(null);
    load();
  };

  const handleCreateChecklist = async () => {
    if (!newCLName.trim()) return;
    const cl = await checklistService.createChecklist({
      name: newCLName.trim(),
      contextSymbol: newCLSymbol.trim(),
      contextSession: newCLSession,
      contextSetup: newCLSetup.trim(),
      isDefault: false,
      items: '[]',
    });
    setSelected(cl);
    setShowCreate(false);
    setNewCLName(''); setNewCLSymbol(''); setNewCLSession(''); setNewCLSetup('');
    load();
    toast({ title: 'چک‌لیست ایجاد شد' });
  };

  const handleDeleteChecklist = async () => {
    if (!selected || selected.isDefault) return;
    if (!confirm(`چک‌لیست "${selected.name}" حذف شود؟`)) return;
    await checklistService.deleteChecklist(selected.id);
    setSelected(null);
    load();
    toast({ title: 'چک‌لیست حذف شد' });
  };

  // Drag-to-reorder
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDrop = async (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx || !selected) return;
    const reordered = [...items];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(toIdx, 0, moved);
    await checklistService.reorderItems(selected.id, reordered);
    setDragIdx(null);
    load();
  };

  const completedCount = checked.size;
  const totalCount     = items.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4" dir="rtl">

      {/* Checklist selector */}
      <div className="flex items-center gap-2">
        <Select
          value={selected?.id ?? ''}
          onValueChange={id => {
            const cl = checklists.find(c => c.id === id);
            if (cl) { setSelected(cl); setChecked(new Set()); setUseMode(false); }
          }}
        >
          <SelectTrigger className="h-9 flex-1 text-sm">
            <SelectValue placeholder="انتخاب چک‌لیست..." />
          </SelectTrigger>
          <SelectContent>
            {checklists.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.isDefault ? '⭐ ' : ''}{c.name}
                {c.contextSymbol ? ` · ${c.contextSymbol}` : ''}
                {c.contextSession ? ` · ${c.contextSession}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">جدید</span>
        </Button>
      </div>

      {selected && (
        <>
          {/* Checklist header + actions */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">{selected.name}</h3>
              {(selected.contextSymbol || selected.contextSession || selected.contextSetup) && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {[selected.contextSymbol, selected.contextSession, selected.contextSetup].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!useMode ? (
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setUseMode(true); setChecked(new Set()); }}>
                  <Play className="h-3.5 w-3.5" />استفاده
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setUseMode(false)}>
                  <Settings2 className="h-3.5 w-3.5" />ویرایش
                </Button>
              )}
              {!selected.isDefault && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={handleDeleteChecklist}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Use mode: progress bar */}
          {useMode && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{completedCount} از {totalCount} آیتم تأیید شد</span>
                <span className={pct === 100 ? 'text-green-400 font-medium' : 'text-muted-foreground'}>{pct}٪</span>
              </div>
              <div className="h-1.5 bg-muted/40 rounded-full">
                <div
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#22c55e' : '#3b82f6' }}
                />
              </div>
              {pct === 100 && (
                <p className="text-xs text-green-400 text-center mt-1">✅ همه آیتم‌ها تأیید شدند — آماده معامله!</p>
              )}
            </div>
          )}

          {/* Items list */}
          <div className="space-y-2">
            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">چک‌لیست خالی است</p>
                <p className="text-xs mt-1">آیتم اضافه کنید</p>
              </div>
            )}
            {items.map((item, idx) => {
              const linkedNote = item.linkedNoteId ? noteMap[item.linkedNoteId] : null;
              const isChecked  = checked.has(item.id);
              return (
                <div
                  key={item.id}
                  draggable={!useMode}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={() => handleDrop(idx)}
                  className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-all
                    ${isChecked ? 'bg-green-500/10 border-green-500/30 opacity-70' : 'bg-card border-border/60'}
                    ${!useMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  {!useMode && (
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                  )}
                  {useMode && (
                    <button
                      className={`h-4 w-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors
                        ${isChecked ? 'bg-green-500 border-green-500' : 'border-muted-foreground/40'}`}
                      onClick={() => setChecked(prev => {
                        const n = new Set(prev);
                        isChecked ? n.delete(item.id) : n.add(item.id);
                        return n;
                      })}
                    >
                      {isChecked && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                      {item.text}
                    </p>
                    {linkedNote && (
                      <p className="text-[10px] text-primary/70 mt-0.5">
                        🔗 {linkedNote.title}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] font-medium ${ITEM_PRIORITY_COLORS[item.priority]}`}>
                      {item.priority === 'critical' ? '🔴' : item.priority === 'high' ? '🟠' : item.priority === 'medium' ? '🟡' : '⚪'}
                    </span>
                    {!useMode && (
                      <>
                        <ActionBtn icon={Edit2} label="ویرایش" onClick={() => setEditItem(item)} />
                        <ActionBtn icon={Trash2} label="حذف" onClick={() => handleDeleteItem(item.id)} className="text-destructive" />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add item */}
          {!useMode && (
            <Card className="border-dashed">
              <CardContent className="pt-3 pb-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">افزودن آیتم جدید</p>
                <Input
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  placeholder="متن آیتم چک‌لیست..."
                  className="text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                />
                <div className="flex gap-2">
                  <Select value={newItemPrio} onValueChange={v => setNewItemPrio(v as NoteImportance)}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">🔴 حیاتی</SelectItem>
                      <SelectItem value="high">🟠 بالا</SelectItem>
                      <SelectItem value="medium">🟡 متوسط</SelectItem>
                      <SelectItem value="low">⚪ پایین</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={newItemNote} onValueChange={setNewItemNote}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="لینک به یادداشت (اختیاری)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— بدون لینک —</SelectItem>
                      {notes.filter(n => n.status !== 'archived').slice(0, 30).map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.title.slice(0, 40)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddItem} disabled={!newItemText.trim()} className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Create checklist dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>چک‌لیست جدید</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">نام چک‌لیست *</label>
              <Input value={newCLName} onChange={e => setNewCLName(e.target.value)} placeholder="مثال: ستاپ شکست, چک‌لیست لندن..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">نماد (اختیاری)</label>
                <Input value={newCLSymbol} onChange={e => setNewCLSymbol(e.target.value)} placeholder="XAUUSD" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">سشن (اختیاری)</label>
                <Select value={newCLSession} onValueChange={setNewCLSession}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="همه" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">همه</SelectItem>
                    <SelectItem value="london">لندن</SelectItem>
                    <SelectItem value="newyork">نیویورک</SelectItem>
                    <SelectItem value="asian">آسیا</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ستاپ (اختیاری)</label>
              <Input value={newCLSetup} onChange={e => setNewCLSetup(e.target.value)} placeholder="مثال: breakout, reversal..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>انصراف</Button>
            <Button onClick={handleCreateChecklist} disabled={!newCLName.trim()}>ایجاد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      {editItem && (
        <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
          <DialogContent dir="rtl" className="max-w-sm">
            <DialogHeader><DialogTitle>ویرایش آیتم</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">متن</label>
                <Input
                  value={editItem.text}
                  onChange={e => setEditItem(prev => prev ? { ...prev, text: e.target.value } : null)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">اولویت</label>
                <Select value={editItem.priority} onValueChange={v => setEditItem(prev => prev ? { ...prev, priority: v as NoteImportance } : null)}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 حیاتی</SelectItem>
                    <SelectItem value="high">🟠 بالا</SelectItem>
                    <SelectItem value="medium">🟡 متوسط</SelectItem>
                    <SelectItem value="low">⚪ پایین</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">لینک به یادداشت</label>
                <Select value={editItem.linkedNoteId ?? ''} onValueChange={v => setEditItem(prev => prev ? { ...prev, linkedNoteId: v || null } : null)}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="بدون لینک" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— بدون لینک —</SelectItem>
                    {notes.filter(n => n.status !== 'archived').slice(0, 30).map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.title.slice(0, 40)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItem(null)}>انصراف</Button>
              <Button onClick={() => editItem && handleUpdateItem(editItem)}>ذخیره</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Daily Focus Tab ─────────────────────────────────────────────────

function DailyFocusTab({ notes }: { notes: KnowledgeNote[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [focus, setFocus]                 = useState<DailyFocus | null>(null);
  const [intention, setIntention]         = useState('');
  const [focusNote, setFocusNote]         = useState('');
  const [linkedIds, setLinkedIds]         = useState<string[]>([]);
  const [reflection, setReflection]       = useState<PostTradingReflection>(DEFAULT_REFLECTION);
  const [mode, setMode]                   = useState<'intention' | 'reflection' | 'history'>('intention');
  const [history, setHistory]             = useState<DailyFocus[]>([]);
  const [saving, setSaving]               = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [tf, hist] = await Promise.all([
      checklistService.getTodayFocus(),
      checklistService.getAllFocus(20),
    ]);
    setHistory(hist);
    if (tf) {
      setFocus(tf);
      setIntention(tf.intention);
      setFocusNote(tf.focusNote);
      setLinkedIds(JSON.parse(tf.linkedNoteIds || '[]'));
      setReflection(checklistService.parseReflection(tf.postReflection));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveIntention = async () => {
    setSaving(true);
    try {
      await checklistService.saveTodayFocus(intention, focusNote, linkedIds);
      toast({ title: 'فوکوس امروز ذخیره شد ✓' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReflection = async () => {
    setSaving(true);
    try {
      await checklistService.savePostReflection(today, reflection);
      toast({ title: 'تأمل ثبت شد ✓' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const ruleLessons = useMemo(
    () => notes.filter(n => (n.isRule || n.category === 'lessons-learned' || n.category === 'mistakes') && n.status !== 'archived').slice(0, 40),
    [notes]
  );

  const linkedNotes = useMemo(
    () => notes.filter(n => linkedIds.includes(n.id)),
    [notes, linkedIds]
  );

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('fa-IR', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Mode switcher */}
      <div className="flex gap-2 bg-muted/30 rounded-lg p-1">
        {([
          { key: 'intention', icon: Focus, label: 'فوکوس امروز' },
          { key: 'reflection', icon: FileText, label: 'تأمل پس از معامله' },
          { key: 'history', icon: Calendar, label: 'تاریخچه' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors
              ${mode === tab.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Intention mode */}
      {mode === 'intention' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Focus className="h-4 w-4 text-primary" />
                فوکوس امروز — {formatDate(today)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">قصد و نیت امروز</label>
                <Textarea
                  value={intention}
                  onChange={e => setIntention(e.target.value)}
                  placeholder="مثال: امروز بر صبر تمرکز می‌کنم. فقط بهترین ستاپ‌ها را معامله می‌کنم..."
                  rows={3}
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">یادداشت آزاد</label>
                <Textarea
                  value={focusNote}
                  onChange={e => setFocusNote(e.target.value)}
                  placeholder="هر چیزی که می‌خواهید یادداشت کنید..."
                  rows={2}
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">یادداشت‌های مرتبط (قوانین / درس‌ها)</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {linkedNotes.map(n => (
                    <span
                      key={n.id}
                      className="text-[10px] bg-primary/10 text-primary rounded px-2 py-0.5 cursor-pointer"
                      onClick={() => setLinkedIds(prev => prev.filter(id => id !== n.id))}
                    >
                      {n.title.slice(0, 30)} ×
                    </span>
                  ))}
                </div>
                <Select value="" onValueChange={v => { if (v && !linkedIds.includes(v)) setLinkedIds(prev => [...prev, v]); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="افزودن یادداشت مرتبط..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ruleLessons.filter(n => !linkedIds.includes(n.id)).map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.title.slice(0, 50)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveIntention} disabled={saving} className="w-full gap-2">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                ذخیره فوکوس امروز
              </Button>
            </CardContent>
          </Card>

          {/* Linked notes preview */}
          {linkedNotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">یادداشت‌های انتخاب‌شده برای امروز:</p>
              {linkedNotes.map(n => (
                <div key={n.id} className={`rounded-lg border p-2.5 text-xs ${IMPORTANCE_CONFIG[n.importance]?.bg}`} style={{ borderLeftWidth: 3, borderLeftColor: n.color }}>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reflection mode */}
      {mode === 'reflection' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                تأمل پس از معامله — {formatDate(today)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'mostRelevantReminder', label: 'کدام یادداشت/قانون امروز مرتبط‌ترین بود؟', placeholder: 'عنوان یادداشتی که بیشترین کمک کرد...' },
                { key: 'rulesFollowed',        label: 'کدام قانون را خوب اجرا کردم؟',             placeholder: 'قوانینی که امروز پایبند بودم...' },
                { key: 'rulesIgnored',         label: 'کدام قانون را نادیده گرفتم؟',             placeholder: 'قوانینی که امروز نقض کردم...' },
                { key: 'learned',              label: 'امروز چه یاد گرفتم؟',                     placeholder: 'درسی که از امروز گرفتم...' },
                { key: 'rememberTomorrow',     label: 'فردا چه چیزی را باید به یاد داشته باشم؟', placeholder: 'مهم‌ترین نکته‌ای که باید یادم باشد...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Textarea
                    value={reflection[key as keyof PostTradingReflection]}
                    onChange={e => setReflection(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    rows={2}
                    className="mt-1 text-sm"
                  />
                </div>
              ))}
              <Button onClick={handleSaveReflection} disabled={saving} className="w-full gap-2">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                ثبت تأمل
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History mode */}
      {mode === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">تاریخچه‌ای موجود نیست</p>
            </div>
          ) : history.map(f => {
            const ref = checklistService.parseReflection(f.postReflection);
            const hasReflection = f.reviewedAt !== null;
            return (
              <Card key={f.id} className="overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{formatDate(f.date)}</span>
                    <Badge variant="outline" className={`text-[10px] ${hasReflection ? 'text-green-400 border-green-400/30' : 'text-muted-foreground'}`}>
                      {hasReflection ? '✓ تأمل شد' : 'بدون تأمل'}
                    </Badge>
                  </div>
                  {f.intention && (
                    <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 mb-2">
                      <span className="font-medium text-foreground/70">قصد: </span>{f.intention}
                    </div>
                  )}
                  {hasReflection && ref.learned && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">یاد گرفتم: </span>{ref.learned}
                    </div>
                  )}
                  {hasReflection && ref.rememberTomorrow && (
                    <div className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-foreground/70">یادآوری فردا: </span>{ref.rememberTomorrow}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Insights / Reinforcement Tab ────────────────────────────────────

type PatternKey = 'earlyEntry' | 'noConfirmation' | 'slMoved' | 'closedEarly' | 'riskIncreased';

function InsightsTab({ notes }: { notes: KnowledgeNote[] }) {
  const [data, setData] = useState<Array<{
    key: PatternKey;
    label: string;
    result: Awaited<ReturnType<typeof knowledgeService.getLessonReinforcement>>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [regressions, setRegressions] = useState<Array<{ patternLabel: string; summary: string }>>([]);

  useEffect(() => {
    const patterns: PatternKey[] = ['earlyEntry', 'noConfirmation', 'slMoved', 'closedEarly', 'riskIncreased'];
    const labels: Record<PatternKey, string> = {
      earlyEntry:    'ورود زودهنگام',
      noConfirmation:'ورود بدون تأیید',
      slMoved:       'جابجایی حد ضرر',
      closedEarly:   'بستن زودهنگام',
      riskIncreased: 'افزایش ریسک',
    };
    Promise.all(patterns.map(k => knowledgeService.getLessonReinforcement(k).then(r => ({ key: k, label: labels[k], result: r }))))
      .then(results => {
        setData(results.filter(r => r.result !== null));
        setRegressions(results.filter(r => r.result?.regression).map(r => ({
          patternLabel: r.label,
          summary: r.result!.summary,
        })));
      })
      .finally(() => setLoading(false));
  }, []);

  // Most-reviewed and quality notes
  const topQualityNotes = useMemo(() =>
    [...notes]
      .filter(n => n.status !== 'archived' && n.isActive)
      .map(n => ({ note: n, q: knowledgeService.getKnowledgeQuality(n) }))
      .sort((a, b) => b.q.score - a.q.score)
      .slice(0, 5),
    [notes]
  );

  const weakQualityNotes = useMemo(() =>
    [...notes]
      .filter(n => n.status !== 'archived' && n.isActive)
      .map(n => ({ note: n, q: knowledgeService.getKnowledgeQuality(n) }))
      .filter(({ q }) => q.level === 'weak' || q.level === 'moderate')
      .sort((a, b) => a.q.score - b.q.score)
      .slice(0, 5),
    [notes]
  );

  if (loading) return (
    <div className="space-y-3 animate-in fade-in duration-300" dir="rtl">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">

      {/* Regression alerts */}
      {regressions.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              هشدار: بازگشت الگوی قدیمی
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {regressions.map((r, i) => (
              <div key={i} className="text-xs p-2 rounded bg-orange-500/10 border border-orange-500/20">
                <p className="font-medium text-orange-300">{r.patternLabel}</p>
                <p className="text-muted-foreground mt-0.5">{r.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Behavior reinforcement patterns */}
      {data.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              تغییر رفتار — تاریخی در مقابل اخیر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.map(({ key, label, result }) => {
              if (!result) return null;
              const histPct  = Math.round(result.historicalRate * 100);
              const recPct   = Math.round(result.recentRate * 100);
              const improved = result.improving === true;
              const regress  = result.regression;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{label}</span>
                    <div className="flex items-center gap-1">
                      {regress  && <span className="text-[10px] text-orange-400 bg-orange-400/10 rounded px-1.5 py-0.5">⚠️ بازگشت</span>}
                      {improved && <span className="text-[10px] text-green-400 bg-green-400/10 rounded px-1.5 py-0.5">✅ بهبود</span>}
                      {!improved && !regress && result.improving !== null && (
                        <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">بدون تغییر</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">تاریخی ({result.historicalCount}/{result.total - result.recentTotal})</p>
                      <div className="h-1.5 bg-muted/40 rounded-full">
                        <div className="h-1.5 rounded-full bg-muted-foreground/40" style={{ width: `${histPct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 text-left">{histPct}٪</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">اخیر ({result.recentCount}/{result.recentTotal})</p>
                      <div className="h-1.5 bg-muted/40 rounded-full">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${recPct}%`,
                            backgroundColor: regress ? '#f97316' : improved ? '#22c55e' : '#6b7280',
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 text-left">{recPct}٪</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 italic">{result.summary}</p>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground/50 text-center pt-1">
              * تحلیل بر اساس داده‌های موجود — این نتایج لازم نیست علیّ باشند
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">برای تحلیل رفتار حداقل ۵ معامله با ریویو نیاز است</p>
        </div>
      )}

      {/* Knowledge quality ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-400" />
            یادداشت‌های با کیفیت بالا
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topQualityNotes.length === 0 ? (
            <p className="text-xs text-muted-foreground">یادداشتی موجود نیست</p>
          ) : (
            <div className="space-y-2">
              {topQualityNotes.map(({ note, q }) => (
                <div key={note.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{note.title}</p>
                    <p className="text-[10px] text-muted-foreground">{q.label}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-12 bg-muted/40 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${q.score}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-left">{q.score}٪</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes needing improvement */}
      {weakQualityNotes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              یادداشت‌هایی که نیاز به بهبود دارند
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {weakQualityNotes.map(({ note, q }) => (
                <div key={note.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{note.title}</p>
                    <p className="text-[10px] text-muted-foreground">اضافه کردن تگ، شواهد یا شرایط کاربرد کیفیت را بالا می‌برد</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-12 bg-muted/40 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-yellow-500" style={{ width: `${q.score}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-left">{q.score}٪</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof knowledgeService.getStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editNote, setEditNote] = useState<KnowledgeNote | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<KnowledgeNote | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('briefing');
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [n, c, s] = await Promise.all([
      knowledgeService.getAllNotes(),
      knowledgeService.getCategories(),
      knowledgeService.getStats(),
    ]);
    setNotes(n);
    setCategories(c);
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Partial<KnowledgeNote>) => {
    if (editNote?.id) {
      await knowledgeService.updateNote(editNote.id, data);
      toast({ title: 'یادداشت بروزرسانی شد' });
    } else {
      await knowledgeService.createNote(data);
      toast({ title: 'یادداشت ایجاد شد' });
    }
    setEditNote(null);
    setShowCreate(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('این یادداشت حذف شود؟')) return;
    await knowledgeService.deleteNote(id);
    toast({ title: 'یادداشت حذف شد' });
    load();
  };

  const handleMarkReviewed = async (id: string) => {
    await knowledgeService.markReviewed(id);
    toast({ title: 'مرور شد ✓', description: 'تاریخ آخرین مرور ثبت شد' });
    load();
  };

  const [snoozeTarget, setSnoozeTarget] = useState<string | null>(null);

  const handleSnooze = (id: string) => setSnoozeTarget(id);

  const handleSnoozeConfirm = async (days: number) => {
    if (!snoozeTarget) return;
    await knowledgeService.snoozeNote(snoozeTarget, days);
    const labels: Record<number, string> = { 1: 'فردا', 3: '۳ روز دیگر', 7: 'هفته آینده' };
    toast({ title: `تعویق شد تا ${labels[days] ?? `${days} روز دیگر`}` });
    setSnoozeTarget(null);
    load();
  };

  const handleArchive = async (id: string) => {
    await knowledgeService.archiveNote(id);
    toast({ title: 'آرشیو شد' });
    load();
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await knowledgeService.pinNote(id, pinned);
    load();
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await knowledgeService.toggleActive(id, active);
    load();
  };

  const handleFeedbackSubmit = async (id: string, rating: string, text: string) => {
    await knowledgeService.submitFeedback(id, rating as NoteUserFeedback['rating'], text);
    toast({ title: 'بازخورد ثبت شد' });
    load();
  };

  const handleGenerateAI = async () => {
    setAiLoading(true);
    try {
      const result = await knowledgeService.generateAIInsights();
      toast({
        title: `بینش‌های AI تولید شد`,
        description: `${result.created} جدید، ${result.updated} بروزرسانی شد`,
      });
      load();
    } catch (err) {
      toast({ title: 'خطا', description: String(err), variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const timelineNotes = useMemo(() => [...notes].sort((a, b) => b.createdAt - a.createdAt), [notes]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto pb-20 md:pb-6 space-y-4 animate-in fade-in duration-300" dir="rtl">
        <div className="flex items-center justify-between mb-4 px-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            پایگاه دانش معاملاتی
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats?.active ?? 0} یادداشت فعال · {stats?.rules ?? 0} قانون
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateAI}
            disabled={aiLoading}
            className="gap-1.5 text-xs"
          >
            {aiLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-purple-400" />}
            <span className="hidden sm:inline">تولید بینش AI</span>
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditNote(null); setShowCreate(true); }}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">یادداشت جدید</span>
          </Button>
        </div>
      </div>

      {/* Tabs — scrollable on mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full overflow-x-auto">
          <TabsList className="flex w-max min-w-full h-9 mb-4 gap-0.5">
            <TabsTrigger value="briefing" className="text-xs gap-1 flex-1 min-w-[64px]">
              <Brain className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">برفینگ</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1 flex-1 min-w-[64px]">
              <BookOpen className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">یادداشت‌ها</span>
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs gap-1 flex-1 min-w-[60px]">
              <Shield className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">قوانین</span>
            </TabsTrigger>
            <TabsTrigger value="checklist" className="text-xs gap-1 flex-1 min-w-[64px]">
              <ListChecks className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">چک‌لیست</span>
            </TabsTrigger>
            <TabsTrigger value="daily" className="text-xs gap-1 flex-1 min-w-[56px]">
              <Focus className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">فوکوس</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs gap-1 flex-1 min-w-[60px]">
              <Activity className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">پیشرفت</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs gap-1 flex-1 min-w-[64px]">
              <Calendar className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">تایم‌لاین</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs gap-1 flex-1 min-w-[52px]">
              <BarChart3 className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">آمار</span>
            </TabsTrigger>
          </TabsList>
        </ScrollArea>

        <TabsContent value="briefing">
          <BriefingTab categories={categories} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab
            notes={notes}
            categories={categories}
            onEdit={n => { setEditNote(n); setShowCreate(true); }}
            onDelete={handleDelete}
            onMarkReviewed={handleMarkReviewed}
            onSnooze={handleSnooze}
            onArchive={handleArchive}
            onPin={handlePin}
            onFeedback={n => setFeedbackNote(n)}
          />
        </TabsContent>

        <TabsContent value="rules">
          <RulesTab
            notes={notes}
            categories={categories}
            onEdit={n => { setEditNote(n); setShowCreate(true); }}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
            onMarkReviewed={handleMarkReviewed}
            onFeedback={n => setFeedbackNote(n)}
          />
        </TabsContent>

        <TabsContent value="checklist">
          <ChecklistTab notes={notes} />
        </TabsContent>

        <TabsContent value="daily">
          <DailyFocusTab notes={notes} />
        </TabsContent>

        <TabsContent value="insights">
          <InsightsTab notes={notes} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab notes={timelineNotes} />
        </TabsContent>

        <TabsContent value="stats">
          <StatsTab stats={stats} categories={categories} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <NoteFormDialog
        key={`${showCreate ? 'open' : 'closed'}:${editNote?.id ?? 'new'}`}
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditNote(null); }}
        onSave={handleSave}
        initial={editNote ?? undefined}
        categories={categories}
      />

      <FeedbackDialog
        note={feedbackNote}
        onClose={() => setFeedbackNote(null)}
        onSubmit={handleFeedbackSubmit}
      />

      {/* Snooze duration dialog */}
      <Dialog open={!!snoozeTarget} onOpenChange={() => setSnoozeTarget(null)}>
        <DialogContent dir="rtl" className="max-w-xs">
          <DialogHeader><DialogTitle>تا چه زمانی تعویق شود؟</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-2">
            {[
              { days: 1, label: 'فردا', icon: '🌙' },
              { days: 3, label: '۳ روز', icon: '📅' },
              { days: 7, label: 'هفته آینده', icon: '📆' },
            ].map(opt => (
              <button
                key={opt.days}
                onClick={() => handleSnoozeConfirm(opt.days)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <span className="text-xl">{opt.icon}</span>
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSnoozeTarget(null)}>انصراف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
