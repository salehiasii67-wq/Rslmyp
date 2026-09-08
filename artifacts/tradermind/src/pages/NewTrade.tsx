symbol = customInput.trim().toUpperCase();
            if (!symbol) return;
            const next = [...customSymbols.filter(s => s.value !== symbol), { value: symbol, label: 'نماد سفارشی', market: tradeMarket(symbol) }];
            setCustomSymbols(next);
            localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(next));
            onChange(symbol);
            setCustomInput('');
          }}
        >
          افزودن
        </Button>
      </div>
      {customSymbols.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {customSymbols.map(symbol => (
            <div key={symbol.value} className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs">
              <button type="button" onClick={() => onChange(symbol.value)} className="text-primary hover:underline">
                {symbol.value}
              </button>
              <button
                type="button"
                aria-label={`حذف نماد ${symbol.value}`}
                onClick={() => {
                  const next = customSymbols.filter(item => item.value !== symbol.value);
                  setCustomSymbols(next);
                  localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(next));
                  if (displayValue === symbol.value) onChange('');
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function tradeMarket(symbol: string): string {
  if (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY')) return 'Forex';
  return 'Other';
}

export default function NewTrade() {
  const [, setLocation] = useLocation();
  // FIX: در hash routing الکترون، query params باید مستقیماً از hash خوانده شوند
  // چون useElectronHashLocation اکنون فقط path را برمی‌گرداند (بدون query string)
  // تا Wouter بتواند route matching درستی انجام دهد
  const _searchStr = window.location.protocol === 'file:'
    ? (() => {
        const hash = window.location.hash.replace(/^#/, '');
        const qIdx = hash.indexOf('?');
        return qIdx >= 0 ? hash.slice(qIdx + 1) : '';
      })()
    : window.location.search;
  const searchParams = new URLSearchParams(_searchStr);
  const sessionId = searchParams.get('sessionId');
  const editId = searchParams.get('editId');
  const returnTo = searchParams.get('returnTo');
  // idFromUrl فقط برای بازیابی پیش‌نویس پس از رفرش صفحه استفاده می‌شود
  // اگر new=true باشد یا editId وجود داشته باشد، از آن صرف‌نظر می‌شود
  const isNewTrade = searchParams.get('new') === 'true';
  const idFromUrl = (isNewTrade || editId) ? null : searchParams.get('id');

  const [trade, setTrade] = useState<Trade | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [session, setSession] = useState<AnalysisSession | null>(null);
  const [linkedStrategy, setLinkedStrategy] = useState<Strategy | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tradingBoxes, setTradingBoxes] = useState<TradingBox[]>([]);
  const [customSetups, setCustomSetups] = useState<string[]>(getCustomSetups);
  const [customSetupInput, setCustomSetupInput] = useState('');
  // ورودی متن جداست تا مقدارهای میانی مثل «۰.» هنگام تایپ با رندر مجدد پاک نشوند.
  const [positionSizeInput, setPositionSizeInput] = useState('');
  const [riskPercentageInput, setRiskPercentageInput] = useState('');

  useEffect(() => {
    db.trades.toArray().then(setAllTrades);
    accountService.getAll().then(setAccounts);
    tradingBoxService.getAll().then(setTradingBoxes);
  }, []);

  // بررسی معامله تکراری
  useEffect(() => {
    if (!trade || !trade.symbol || !trade.entryPrice || !initialized.current) return;
    const check = async () => {
      const existing = await db.trades
        .where('symbol').equalsIgnoreCase(trade.symbol).toArray();
      const dup = existing.find(t =>
        t.id !== trade.id &&
        t.direction === trade.direction &&
        Math.abs(t.entryPrice - trade.entryPrice) < trade.entryPrice * 0.001 &&
        Math.abs(t.openedAt - trade.openedAt) < 60_000
      );
      if (dup) {
        setDuplicateWarning(`احتمال تکرار: معامله مشابهی در ${new Date(dup.openedAt).toLocaleDateString('fa-IR')} ثبت شده است.`);
      } else {
        setDuplicateWarning(null);
      }
    };
    const timer = setTimeout(check, 1000);
    return () => clearTimeout(timer);
  }, [trade?.symbol, trade?.direction, trade?.entryPrice, trade?.openedAt]);

  const tradeIdRef = useRef<string | null>(editId || idFromUrl || null);
  const lastSavedRef = useRef<Trade | null>(null);
  const initialized = useRef(false);
  // Tracks the last set of URL params we initialized for — re-init when they change
  const lastInitKey = useRef<string>('__unset__');
  const requestNavigation = useGuardedNavigation();

  useEffect(() => {
    // Build a key from the current URL params that identify which trade to open
    // Using editId|idFromUrl|sessionId so any change triggers a fresh load
    const currentKey = `${editId ?? ''}|${idFromUrl ?? ''}|${sessionId ?? ''}`;

    // Skip if we already initialized for this exact combination (prevents StrictMode double-run)
    if (lastInitKey.current === currentKey && initialized.current) return;
    lastInitKey.current = currentKey;

    // Reset state for fresh initialization
    initialized.current = false;
    tradeIdRef.current = editId || idFromUrl || null;
    lastSavedRef.current = null;
    setTrade(null);

    const init = async () => {
      if (initialized.current) return;
      initialized.current = true;

      const strats = await strategyService.getAllStrategies();
      setStrategies(strats);

      let currentTrade: Trade | null = null;

      const requestedTradeId = tradeIdRef.current;

      if (requestedTradeId) {
        const existing = await tradeService.getTradeById(requestedTradeId);
        if (existing) {
          currentTrade = existing;
        }
      } 
      
      if (!currentTrade) {
        // Never replace a missing edit/recovery target with a new blank trade.
        // That used to create an empty record when an editId was stale or the
        // IndexedDB read raced with navigation.
        if (requestedTradeId) {
          toast.error('معاملهٔ موردنظر پیدا نشد و معاملهٔ جدیدی ساخته نشد.');
          setLocation('/journal/trades');
          return;
        }

        currentTrade = await tradeService.createTrade({
          sessionId: sessionId || null
        });
        tradeIdRef.current = currentTrade.id;
        // Update URL so a page refresh reloads this draft (doesn't go through Wouter
        // to avoid a re-render loop; query string is only used for recovery on refresh)
        const newSearch = '?id=' + currentTrade.id + (sessionId ? `&sessionId=${sessionId}` : '');
        window.history.replaceState(null, '', window.location.pathname + newSearch);
        // Keep our init key in sync so Wouter re-renders don't re-trigger init
        lastInitKey.current = `|${currentTrade.id}|${sessionId ?? ''}`;
      }

      // Repair older drafts that were saved before market defaults existed.
      // A known symbol always wins; otherwise keep a valid stored market.
      const symbolMarket = TRADING_SYMBOLS.find(s => s.value === currentTrade!.symbol)?.market;
      if (!currentTrade.market && (symbolMarket || currentTrade.symbol)) {
        currentTrade = {
          ...currentTrade,
          market: symbolMarket ?? tradeMarket(currentTrade.symbol),
        };
        await tradeService.updateTrade(currentTrade.id, { market: currentTrade.market });
      }

      setTrade(currentTrade);
      setPositionSizeInput(
        currentTrade.positionSize != null && !POSITION_SIZE_OPTIONS.includes(currentTrade.positionSize)
          ? String(currentTrade.positionSize)
          : ''
      );
      setRiskPercentageInput(
        currentTrade.riskPercentage != null && !RISK_PERCENTAGE_OPTIONS.includes(currentTrade.riskPercentage)
          ? String(currentTrade.riskPercentage)
          : ''
      );
      lastSavedRef.current = currentTrade;

      const targetSessionId = currentTrade.sessionId || sessionId;
      if (targetSessionId) {
        const sess = await analysisService.getSessionById(targetSessionId);
        if (sess) {
          setSession(sess);
          const strat = await strategyService.getStrategyById(sess.strategyId);
          if (strat) setLinkedStrategy(strat);

          if (currentTrade.adherenceScore === null) {
            const score = await tradeService.computeAdherenceScore(sess.id);
            handleChange('adherenceScore', score);
          }
        }
      }
    };
    init();
  }, [editId, idFromUrl, sessionId]);

  const handleChange = useCallback((field: keyof Trade, value: any) => {
    setTrade(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const applyQuickTemplate = useCallback((template: typeof QUICK_TEMPLATES[number]) => {
    handleChange('direction', template.direction);
    handleChange('setupType' as any, template.setupType);
    handleChange('tradingSession' as any, template.tradingSession);
    handleChange('status', 'open');
    toast.success(`قالب «${template.label}» اعمال شد`);
  }, [handleChange]);

  const saveTrade = useCallback(async (dataToSave: Trade) => {
    if (!dataToSave.id) return;
    setIsSaving(true);
    await tradeService.updateTrade(dataToSave.id, dataToSave);
    lastSavedRef.current = dataToSave;
    setIsSaving(false);
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 2000);
  }, []);

  useNavigationGuard({
    isDirty: Boolean(trade && JSON.stringify(trade) !== JSON.stringify(lastSavedRef.current)),
    onSave: async () => {
      if (trade) await saveTrade(trade);
    },
  });

  useEffect(() => {
    if (!trade || !initialized.current) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(trade) !== JSON.stringify(lastSavedRef.current)) {
        saveTrade(trade);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [trade, saveTrade]);

  // اتودیتکت نتیجه بر اساس سود/زیان
  useEffect(() => {
    if (!trade || !initialized.current || trade.status !== 'closed') return;
    if (trade.profitLoss === null || trade.profitLoss === undefined) return;
    let autoResult: string;
    if (trade.profitLoss > 0) autoResult = 'win';
    else if (trade.profitLoss < 0) autoResult = 'loss';
    else autoResult = 'breakeven';
    if (trade.result !== autoResult) {
      handleChange('result', autoResult);
    }
  }, [trade?.profitLoss, trade?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // اگر سود/زیان وارد شده باشد، معامله پایان‌یافته است؛ این برای معاملات
  // قدیمی که دستی تکمیل می‌شوند هم همان رفتار ایمپورت را حفظ می‌کند.
  useEffect(() => {
    if (!trade || !initialized.current) return;
    if (typeof trade.profitLoss !== 'number' || !Number.isFinite(trade.profitLoss)) return;
    const result = trade.profitLoss > 0 ? 'win' : trade.profitLoss < 0 ? 'loss' : 'breakeven';
    if (trade.status !== 'closed' || trade.result !== result) {
      setTrade(prev => prev ? { ...prev, status: 'closed', result } : prev);
    }
  }, [trade?.profitLoss, trade?.status, trade?.result]);

  // باگ ۲: وقتی در حال ویرایش معامله هستیم، برگشت به صفحه جزئیات معامله می‌رود نه لیست
  const backUrl = returnTo || (editId ? `/journal/trades/${editId}` : '/journal/trades');

  const handleCancel = async () => {
    requestNavigation(backUrl);
  };

  const handleSaveAndView = useCallback(async () => {
    if (!trade) return;
    await tradeService.updateTrade(trade.id, trade);
    const detailPath = returnTo
      ? `/journal/trades/${trade.id}?returnTo=${encodeURIComponent(returnTo)}`
      : `/journal/trades/${trade.id}`;
    setLocation(detailPath);
  }, [returnTo, setLocation, trade]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        void handleSaveAndView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveAndView]);

  const handleDateChange = (field: 'openedAt' | 'closedAt', dateString: string) => {
    const timestamp = parseTradingDateTimeInput(dateString);
    if (Number.isNaN(timestamp)) return;
    handleChange(field, timestamp);

    // اگر سشن قبلی خالی یا خودکار بوده، با تغییر ساعت بازشدن آن را دوباره
    // محاسبه کن؛ سشن انتخاب‌شدهٔ دستی کاربر را بازنویسی نکن.
    if (field === 'openedAt' && trade) {
      const previousAutoSession = detectTradingSession(trade.openedAt);
      if (!trade.tradingSession || trade.tradingSession === previousAutoSession) {
        handleChange('tradingSession', detectTradingSession(timestamp));
      }
    }
  };

  const formatDateForInput = (timestamp: number | null) => {
    return getTradingDateTimeInput(timestamp);
  };

  const computeRMultiple = () => {
    if (!trade || trade.exitPrice === null || trade.exitPrice === undefined) return;
    const diff = Math.abs(trade.entryPrice - trade.stopLoss);
    if (diff === 0) return;

    let r = 0;
    if (trade.direction === 'long') {
      r = (trade.exitPrice - trade.entryPrice) / diff;
    } else {
      r = (trade.entryPrice - trade.exitPrice) / diff;
    }
    return r.toFixed(2);
  };

  const toggleEmotion = (emotionId: string) => {
    if (!trade) return;
    const currentEmotions = JSON.parse(trade.emotions || '[]') as string[];
    let updated;
    if (currentEmotions.includes(emotionId)) {
      updated = currentEmotions.filter(e => e !== emotionId);
    } else {
      updated = [...currentEmotions, emotionId];
    }
    handleChange('emotions', JSON.stringify(updated));
  };

  const currentEmotions = trade ? (JSON.parse(trade.emotions || '[]') as string[]) : [];
  const review = trade ? JSON.parse(trade.review || '{}') : {};
  const tags = trade ? JSON.parse(trade.tags || '[]') as string[] : [];
  const tradeScreenshots = trade ? (() => {
    try { return JSON.parse(trade.screenshots || '[]') as TradeScreenshot[]; }
    catch { return []; }
  })() : [];
  const mtf = trade ? (() => {
    try { return JSON.parse(trade.mtfAnalysis || 'null') || {}; }
    catch { return {}; }
  })() : {};
  const updateMtfScenario = (patch: Record<string, unknown>) => {
    const current = mtf.scenario || { status: '', condition: '', noTradeReason: '', invalidation: '' };
    handleChange('mtfAnalysis' as any, JSON.stringify({
      ...mtf,
      scenario: { ...current, ...patch },
    }));
  };
  const computedR = computeRMultiple();
  const netPnl = trade ? getTradeNetPnl(trade) : null;

  if (!trade) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Initializing trade...</div>;
  }

  return (
    <div className="w-full min-w-0 max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 border-b pb-4 sticky top-0 bg-background/80 backdrop-blur z-10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => requestNavigation(backUrl)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{editId ? 'Edit Trade' : 'Log Trade'}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className={`text-muted-foreground transition-opacity ${showSavedIndicator ? 'opacity-100' : 'opacity-0'}`}>
                Saved
              </span>
              {isSaving && <span className="text-muted-foreground animate-pulse">Saving...</span>}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          {/* Quick/Full toggle */}
          <div className="order-3 flex w-full min-w-0 rounded-lg border overflow-hidden sm:order-none sm:w-auto sm:flex-none">
            <Button
              variant={isQuickMode ? 'default' : 'ghost'}
              size="sm"
              className="min-w-0 flex-1 rounded-none gap-1.5 h-9 px-2 sm:flex-none sm:px-3"
              onClick={() => setIsQuickMode(true)}
            >
              <Zap className="w-3.5 h-3.5" /> سریع
            </Button>
            <Button
              variant={!isQuickMode ? 'default' : 'ghost'}
              size="sm"
              className="min-w-0 flex-1 rounded-none gap-1.5 h-9 px-2 sm:flex-none sm:px-3"
              onClick={() => setIsQuickMode(false)}
            >
              <BookOpen className="w-3.5 h-3.5" /> کامل
            </Button>
          </div>
          <Button className="order-1 flex-1 sm:order-none sm:flex-none" variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button className="order-2 flex-1 whitespace-nowrap sm:order-none sm:flex-none" onClick={handleSaveAndView}>
            <Eye className="w-4 h-4 mr-2" /> Save & View
          </Button>
        </div>
      </div>

      {isQuickMode && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5" />
              <span>ثبت سریع: قالب را انتخاب کنید یا با</span>
              <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">Ctrl + Enter</kbd>
              <span>ذخیره کنید.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map(template => (
                <Button
                  key={template.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => applyQuickTemplate(template)}
                >
                  <Zap className="ml-1.5 h-3.5 w-3.5" />
                  {template.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* هشدار تکرار */}
      {duplicateWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{duplicateWarning}</span>
          <button onClick={() => setDuplicateWarning(null)} className="mr-auto shrink-0 hover:opacity-70">✕</button>
        </div>
      )}

      <div className="space-y-12">
        {/* SECTION 1: Trade Info */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">1. Trade Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>نماد معاملاتی (Symbol)</Label>
              <SymbolSelector
                value={trade.symbol}
                onChange={v => {
                  const symbol = v.toUpperCase();
                  handleChange('symbol', symbol);
                  // Keep the market in sync whenever the symbol changes,
                  // including when replacing an existing default symbol.
                  const found = TRADING_SYMBOLS.find(s => s.value === symbol);
                  handleChange('market', found?.market ?? tradeMarket(symbol));
                }}
              />
            </div>

            {/* پانل بینش پیش از معامله — بعد از ورود نماد ظاهر می‌شود */}
            {trade.symbol && trade.symbol.length >= 2 && (
              <div className="lg:col-span-3">
                <PreTradeInsightPanel
                  symbol={trade.symbol}
                  tags={tags}
                  allTrades={allTrades}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Market</Label>
              <Select value={trade.market || ''} onValueChange={v => handleChange('market', v)}>
                <SelectTrigger><SelectValue placeholder="Select Market" /></SelectTrigger>
                <SelectContent>
                  {MARKETS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>شماره تیکت متاتریدر</Label>
              <Input
                value={trade.ticketNumber ?? ''}
                onChange={e => handleChange('ticketNumber' as any, e.target.value || null)}
                placeholder="مثلاً 12345678"
                dir="ltr"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Direction</Label>
              <div className="flex gap-2">
                <Button 
                  variant={trade.direction === 'long' ? 'default' : 'outline'}
                  onClick={() => handleChange('direction', 'long')}
                  className={`flex-1 ${trade.direction === 'long' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50 hover:bg-emerald-500/30' : ''}`}
                >
                  LONG
                </Button>
                <Button 
                  variant={trade.direction === 'short' ? 'default' : 'outline'}
                  onClick={() => handleChange('direction', 'short')}
                  className={`flex-1 ${trade.direction === 'short' ? 'bg-rose-500/20 text-rose-500 border-rose-500/50 hover:bg-rose-500/30' : ''}`}
                >
                  SHORT
                </Button>
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Status</Label>
              <div className="flex gap-2">
                {['open', 'closed', 'cancelled'].map(status => (
                  <Button 
                    key={status}
                    variant={trade.status === status ? 'default' : 'outline'}
                    onClick={() => handleChange('status', status)}
                    className="flex-1 capitalize"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Strategy</Label>
              <Select value={trade.strategyId || 'none'} onValueChange={v => handleChange('strategyId', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select Strategy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Strategy</SelectItem>
                  {strategies.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* حساب معاملاتی */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> حساب معاملاتی</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={() => setLocation('/accounts')}>
                  <Plus className="w-3 h-3" /> مدیریت
                </Button>
              </div>
              <Select value={(trade as any).accountId || 'none'} onValueChange={v => handleChange('accountId' as any, v === 'none' ? null : v)}>
                <SelectTrigger dir="rtl" className="h-auto min-h-9 whitespace-normal [&>span]:!line-clamp-none [&>span]:!whitespace-normal">
                  <SelectValue placeholder="انتخاب حساب (اختیاری)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون حساب</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex min-w-0 items-center gap-2 whitespace-normal break-words text-right" dir="rtl">
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        {a.name}{a.broker ? ` — ${a.broker}` : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* باکس معاملاتی */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> باکس معاملاتی</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={() => setLocation('/trading-boxes')}>
                  <Plus className="w-3 h-3" /> مدیریت
                </Button>
              </div>
              <Select value={(trade as any).boxId || 'none'} onValueChange={v => handleChange('boxId' as any, v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب باکس (اختیاری)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون باکس</SelectItem>
                  {tradingBoxes
                    .filter(b => b.status === 'active' && (!(b as any).accountId || (b as any).accountId === (trade as any).accountId))
                    .map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                        {b.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ── سشن + ستاپ (بخشی از Section 1) ── */}
        {!isQuickMode && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">۱ب. سشن معاملاتی و ستاپ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>سشن معاملاتی</Label>
                <Select value={(trade as any).tradingSession || ''} onValueChange={v => handleChange('tradingSession' as any, v || null)}>
                  <SelectTrigger><SelectValue placeholder="انتخاب کنید…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="london">لندن</SelectItem>
                    <SelectItem value="new-york">نیویورک</SelectItem>
                    <SelectItem value="asia">آسیا</SelectItem>
                    <SelectItem value="overlap">اوورلپ</SelectItem>
                    <SelectItem value="other">سایر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع ستاپ</Label>
                <Select value={(trade as any).setupType || ''} onValueChange={v => handleChange('setupType' as any, v || null)}>
                  <SelectTrigger><SelectValue placeholder="انتخاب کنید…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="break-and-retest">Break and Retest</SelectItem>
                    <SelectItem value="fvg">FVG (Fair Value Gap)</SelectItem>
                    <SelectItem value="liquidity-grab">Liquidity Grab</SelectItem>
                    <SelectItem value="order-block">Order Block</SelectItem>
                    <SelectItem value="trend-continuation">Trend Continuation</SelectItem>
                    <SelectItem value="reversal">Reversal</SelectItem>
                    <SelectItem value="support-resistance">حمایت/مقاومت</SelectItem>
                    <SelectItem value="other">سایر</SelectItem>
                    {customSetups.map(setup => (
                      <SelectItem key={setup} value={setup}>{setup}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    value={customSetupInput}
                    onChange={e => setCustomSetupInput(e.target.value)}
                    placeholder="ستاپ سفارشی جدید…"
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    disabled={!customSetupInput.trim()}
                    onClick={() => {
                      const setup = customSetupInput.trim();
                      if (!setup) return;
                      const next = [...customSetups.filter(item => item !== setup), setup];
                      setCustomSetups(next);
                      localStorage.setItem(CUSTOM_SETUPS_KEY, JSON.stringify(next));
                      handleChange('setupType' as any, setup);
                      setCustomSetupInput('');
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> افزودن
                  </Button>
                </div>
                {customSetups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {customSetups.map(setup => (
                      <span key={setup} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                        {setup}
                        <button
                          type="button"
                          aria-label={`حذف ستاپ ${setup}`}
                          onClick={() => {
                            const next = customSetups.filter(item => item !== setup);
                            setCustomSetups(next);
                            localStorage.setItem(CUSTOM_SETUPS_KEY, JSON.stringify(next));
                            if ((trade as any).setupType === setup) handleChange('setupType' as any, null);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: Entry Details */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">2. Entry Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label>Opened At</Label>
              <Input 
                type="datetime-local" 
                value={formatDateForInput(trade.openedAt)}
                onChange={e => handleDateChange('openedAt', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Entry Price</Label>
              <NumericInput value={trade.entryPrice} onValueChange={value => handleChange('entryPrice', value ?? 0)} />
            </div>
            <div className="space-y-2">
              <Label>Stop Loss</Label>
              <NumericInput value={trade.stopLoss} onValueChange={value => handleChange('stopLoss', value ?? 0)} />
            </div>
            <div className="space-y-2">
              <Label>Take Profit</Label>
              <NumericInput value={trade.takeProfit} onValueChange={value => handleChange('takeProfit', value)} />
            </div>
          </div>
        </section>

        {/* SECTION 3: Position Sizing — از ۰.۰۱ لات شروع می‌شود */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">3. حجم و ریسک</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* حجم پوزیشن — لیست از ۰.۰۱ */}
            <div className="space-y-2">
              <Label>حجم پوزیشن (لات)</Label>
              <Select
                value={trade.positionSize != null ? String(trade.positionSize) : ''}
                onValueChange={v => {
                  setPositionSizeInput('');
                  handleChange('positionSize', v ? parseFloat(v) : null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب حجم…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {POSITION_SIZE_OPTIONS.map(v => (
                    <SelectItem key={v} value={String(v)}>
                      {v % 1 === 0 ? v.toFixed(2) : v < 0.1 ? v.toFixed(2) : v.toFixed(2)} لات
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* ورودی دستی برای مقادیر سفارشی */}
              <Input
                type="text" inputMode="decimal" placeholder="یا مقدار دلخواه وارد کنید…"
                value={positionSizeInput}
                onChange={e => {
                  const value = normalizeDecimalInput(e.target.value);
                  setPositionSizeInput(value);
                  handleChange('positionSize', customDecimalValue(value));
                }}
                className="h-8 text-sm mt-1"
                dir="ltr"
              />
            </div>

            {/* درصد ریسک — لیست */}
            <div className="space-y-2">
              <Label>ریسک (٪)</Label>
              <Select
                value={trade.riskPercentage != null ? String(trade.riskPercentage) : ''}
                onValueChange={v => {
                  setRiskPercentageInput('');
                  handleChange('riskPercentage', v ? parseFloat(v) : null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب ریسک…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {RISK_PERCENTAGE_OPTIONS.map(v => (
                    <SelectItem key={v} value={String(v)}>
                      {v}٪
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text" inputMode="decimal" placeholder="یا مقدار دلخواه…"
                value={riskPercentageInput}
                onChange={e => {
                  const value = normalizeDecimalInput(e.target.value);
                  setRiskPercentageInput(value);
                  handleChange('riskPercentage', customDecimalValue(value));
                }}
                className="h-8 text-sm mt-1"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label>مقدار ریسک ($)</Label>
              <NumericInput value={trade.riskAmount} onValueChange={value => handleChange('riskAmount', value)} />
            </div>
          </div>
        </section>

        {/* ── دلیل ورود ── */}
        {!isQuickMode && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">۳ب. دلیل ورود</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>دلیل ورود به معامله</Label>
                <VoiceInputButton onText={text => handleChange('entryReason' as any, `${(trade as any).entryReason || ''}${(trade as any).entryReason ? ' ' : ''}${text}`)} />
              </div>
              <StableTextarea
                placeholder="چرا وارد این معامله شدید؟ چه چیزی را در چارت دیدید؟ ستاپ چه بود؟"
                value={(trade as any).entryReason || ''}
                onChange={e => handleChange('entryReason' as any, e.target.value || null)}
                className="min-h-[100px]"
              />
            </div>
          </section>
        )}

        {/* SECTION 4: Exit Details */}
        {trade.status === 'closed' && (
          <section className="space-y-6 animate-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold border-b pb-2">4. Exit Details</h2>
            
            <div className="space-y-2">
              <Label>Result</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'win', l: 'Win', c: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' },
                  { v: 'loss', l: 'Loss', c: 'bg-rose-500/20 text-rose-500 border-rose-500/50' },
                  { v: 'breakeven', l: 'Break Even', c: 'bg-slate-500/20 text-slate-500 border-slate-500/50' },
                  { v: 'partial-win', l: 'Partial Win', c: 'bg-teal-500/20 text-teal-500 border-teal-500/50' },
                  { v: 'partial-loss', l: 'Partial Loss', c: 'bg-amber-500/20 text-amber-500 border-amber-500/50' }
                ].map(res => (
                  <Button
                    key={res.v}
                    variant={trade.result === res.v ? 'default' : 'outline'}
                    onClick={() => handleChange('result', res.v)}
                    className={trade.result === res.v ? res.c : ''}
                  >
                    {res.l}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Closed At</Label>
                <Input 
                  type="datetime-local" 
                  value={formatDateForInput(trade.closedAt)}
                  onChange={e => handleDateChange('closedAt', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Exit Price</Label>
                <NumericInput value={trade.exitPrice} onValueChange={value => handleChange('exitPrice', value)} />
              </div>
              <div className="space-y-2">
                <Label>P&L ناخالص</Label>
                <NumericInput value={trade.profitLoss} onValueChange={value => handleChange('profitLoss', value)} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>R Multiple</Label>
                  {computedR && <span className="text-xs text-muted-foreground">Auto: {computedR}R</span>}
                </div>
                <NumericInput value={trade.rMultiple} onValueChange={value => handleChange('rMultiple', value)} />
              </div>
              <div className="space-y-2">
                <Label>هزینه‌های دیگر</Label>
                <NumericInput value={trade.fees} onValueChange={value => handleChange('fees', value)} />
              </div>
              <div className="space-y-2">
                <Label>کمیسیون</Label>
                <NumericInput value={trade.commission} onValueChange={value => handleChange('commission' as any, value)} />
              </div>
              <div className="space-y-2">
                <Label>اسپرد</Label>
                <NumericInput value={trade.spread} onValueChange={value => handleChange('spread' as any, value)} />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label>Reason for Exit</Label>
                <Input value={trade.reasonForExit || ''} onChange={e => handleChange('reasonForExit', e.target.value)} placeholder="Hit target, trailed stop, etc." />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <span className="text-muted-foreground">سود/زیان خالص پس از هزینه‌ها</span>
              <strong className={netPnl !== null && netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                {netPnl !== null ? `${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}` : '—'}
              </strong>
            </div>
          </section>
        )}

        {/* ── مدیریت معامله ── */}
        {!isQuickMode && trade.status === 'closed' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">۴ب. مدیریت معامله</h2>
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'slMoved',         label: 'جابجایی حد ضرر' },
                { key: 'tpMoved',         label: 'جابجایی حد سود' },
                { key: 'partialClose',    label: 'بستن بخشی از پوزیشن' },
                { key: 'addedToPosition', label: 'افزودن به پوزیشن' },
                { key: 'reducedPosition', label: 'کاهش پوزیشن' },
                { key: 'manualExit',      label: 'خروج دستی' },
              ].map(item => {
                const val = (trade as any)[item.key];
                return (
                  <button key={item.key}
                    onClick={() => handleChange(item.key as any, val === true ? false : val === false ? null : true)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-right transition-colors ${
                      val === true ? 'border-primary bg-primary/10 text-primary' :
                      val === false ? 'border-muted-foreground/30 text-muted-foreground/50' :
                      'border-border hover:border-primary/40'
                    }`}>
                    {val === true ? <CheckSquare className="w-4 h-4 shrink-0" /> :
                     val === false ? <Square className="w-4 h-4 shrink-0 opacity-40" /> :
                     <Square className="w-4 h-4 shrink-0" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>توضیح تصمیمات مدیریت</Label>
              <StableTextarea
                placeholder="چرا حد ضرر را جابجا کردید؟ دلیل خروج زودهنگام چه بود؟"
                value={(trade as any).managementReason || ''}
                onChange={e => handleChange('managementReason' as any, e.target.value || null)}
                className="min-h-[80px]"
                voice
              />
            </div>
          </section>
        )}

        {/* SECTION 5: Strategy Adherence — فارسی */}
        {(trade.sessionId || sessionId) && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">5. Strategy Adherence</h2>
            
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Linked Session</div>
                    <div className="font-semibold">{linkedStrategy?.name || 'استراتژی نامشخص'}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setLocation(`/analysis/${trade.sessionId || sessionId}`)}>
                  مشاهده جلسه تحلیل
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>امتیاز پایبندی به استراتژی</span>
                      <span className="font-bold">{trade.adherenceScore ?? 0}%</span>
                    </div>
                    <Progress value={trade.adherenceScore ?? 0} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>تا چه اندازه قوانین استراتژی را رعایت کردی؟</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { v: 'fully', l: 'کاملاً رعایت شد', c: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' },
                        { v: 'mostly', l: 'بیشتر قوانین رعایت شد', c: 'bg-teal-500/20 text-teal-500 border-teal-500/50' },
                        { v: 'partially', l: 'بخشی از قوانین رعایت شد', c: 'bg-amber-500/20 text-amber-500 border-amber-500/50' },
                        { v: 'not', l: 'رعایت نشد', c: 'bg-rose-500/20 text-rose-500 border-rose-500/50' }
                      ].map(rating => (
                        <Button
                          key={rating.v}
                          variant={trade.adherenceRating === rating.v ? 'default' : 'outline'}
                          onClick={() => handleChange('adherenceRating', rating.v)}
                          className={trade.adherenceRating === rating.v ? rating.c : ''}
                        >
                          {rating.l}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>یادداشت پایبندی</Label>
                    <StableTextarea
                      placeholder="اگر از قوانین فاصله گرفتی، دلیل آن را بنویس…"
                      value={trade.adherenceNotes || ''}
                      onChange={e => handleChange('adherenceNotes', e.target.value)}
                      voice
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* SECTION 6: Emotions — به فارسی */}
        {!isQuickMode && (<section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">۶. وضعیت احساسی</h2>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map(emo => {
              const isSelected = currentEmotions.includes(emo.id);
              return (
                <button
                  key={emo.id}
                  onClick={() => toggleEmotion(emo.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isSelected 
                      ? `${emo.color} text-white shadow-md scale-105` 
                      : `bg-muted/50 text-muted-foreground hover:bg-muted border border-border`
                  }`}
                >
                  {emo.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label>یادداشت احساسی</Label>
            <Textarea 
              placeholder="در طول این معامله چه احساسی داشتید؟"
              value={trade.emotionNotes || ''}
              onChange={e => handleChange('emotionNotes', e.target.value)}
            />
          </div>
        </section>)}

        {/* ── تحلیل چند تایم‌فریمی (MTF) ── */}
        {!isQuickMode && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">۶ب. تحلیل چند تایم‌فریمی</h2>
            {(['4H', '15M', '5M', '1M'] as const).map(tf => {
              const tfData = mtf[tf] || {};
              const update = (field: string, value: string) => {
                const newMtf = { ...mtf, [tf]: { ...tfData, [field]: value } };
                handleChange('mtfAnalysis' as any, JSON.stringify(newMtf));
              };
              return (
                <Card key={tf} className="bg-muted/10">
                  <CardContent className="p-4 space-y-3">
                    <div className="font-semibold text-sm">{tf}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">اسکرین‌شات مستقل این تایم‌فریم</Label>
                        <select
                          value={tfData.screenshotId || ''}
                          onChange={e => update('screenshotId', e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">بدون اسکرین‌شات</option>
                          {tradeScreenshots.map(ss => (
                            <option key={ss.id} value={ss.id}>
                              {ss.label || 'تصویر'}{ss.timeframe ? ` — ${ss.timeframe}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">بایاس / جهت</Label>
                        <Input value={tfData.bias || ''} onChange={e => update('bias', e.target.value)} placeholder="صعودی / نزولی / خنثی" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ساختار بازار</Label>
                        <Input value={tfData.structure || ''} onChange={e => update('structure', e.target.value)} placeholder="HH/HL، LL/LH" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">زمینه و یادداشت</Label>
                        <StableTextarea value={tfData.context || ''} onChange={e => update('context', e.target.value)} placeholder={`زمینه و تحلیل ${tf} را وارد کنید…`} className="min-h-[60px] text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">تأییدیه</Label>
                        <Input value={tfData.confirmation || ''} onChange={e => update('confirmation', e.target.value)} placeholder="چه چیزی تأیید شد؟" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">سطوح مهم</Label>
                        <Input value={tfData.importantLevels || ''} onChange={e => update('importantLevels', e.target.value)} placeholder="سطوح قیمت…" className="h-8 text-sm" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card className="border-amber-500/25 bg-amber-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold text-sm">تصمیم سناریو</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">وضعیت سناریو</Label>
                    <select
                      value={mtf.scenario?.status || ''}
                      onChange={e => updateMtfScenario({ status: e.target.value as any })}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">انتخاب کنید…</option>
                      <option value="liquidity-hunt">لو‌هانت / جمع‌آوری نقدینگی</option>
                      <option value="confirmation">تأییدیه دریافت شد</option>
                      <option value="scenario-failed">سناریو شکست خورد</option>
                      <option value="no-trade">وارد نشدم</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">شرط فعال شدن سناریو</Label>
                    <Input value={mtf.scenario?.condition || ''} onChange={e => updateMtfScenario({ condition: e.target.value })} placeholder="اگر قیمت/ساختار به این شرط رسید…" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">{mtf.scenario?.status === 'no-trade' ? 'دلیل وارد نشدن' : 'توضیح سناریو و نتیجه'}</Label>
                    <StableTextarea
                      value={mtf.scenario?.noTradeReason || ''}
                      onChange={e => updateMtfScenario({ noTradeReason: e.target.value })}
                      placeholder={mtf.scenario?.status === 'no-trade' ? 'چه چیزی مانع ورود شد؟' : 'چه اتفاقی برای سناریو افتاد؟'}
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">شرط ابطال</Label>
                    <Input value={mtf.scenario?.invalidation || ''} onChange={e => updateMtfScenario({ invalidation: e.target.value })} placeholder="در چه شرایطی تحلیل دیگر معتبر نیست؟" className="h-8 text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* SECTION 7: Screenshots */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">۷. اسکرین‌شات‌ها</h2>
          <ScreenshotManager
            trade={trade}
            allTrades={allTrades}
            onChange={screenshots => handleChange('screenshots', JSON.stringify(screenshots))}
          />
        </section>

        {/* SECTION 8: Review */}
        {!isQuickMode && trade.status === 'closed' && (
          <section className="space-y-6 animate-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold border-b pb-2">8. Trade Review</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>What did I do well?</Label>
                <StableTextarea
                  value={review.didWell || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, didWell: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>What did I do wrong?</Label>
                <StableTextarea
                  value={review.didWrong || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, didWrong: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>What did I learn?</Label>
                <StableTextarea
                  value={review.learned || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, learned: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Would I take this trade again?</Label>
                <div className="flex gap-2">
                  {['yes', 'no', 'maybe'].map(val => (
                    <Button
                      key={val}
                      variant={review.wouldTakeAgain === val ? 'default' : 'outline'}
                      onClick={() => handleChange('review', JSON.stringify({ ...review, wouldTakeAgain: val }))}
                      className="flex-1 capitalize"
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Was this a valid setup?</Label>
                <div className="flex gap-2">
                  {['yes', 'no', 'unclear'].map(val => (
                    <Button
                      key={val}
                      variant={review.validSetup === val ? 'default' : 'outline'}
                      onClick={() => handleChange('review', JSON.stringify({ ...review, validSetup: val }))}
                      className="flex-1 capitalize"
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 9: Notes & Tags */}
        {!isQuickMode && (<section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">9. Notes & Tags</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input 
                placeholder="Press Enter to add tags (e.g., trend-following, fvg, overtrading)" 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val && !tags.includes(val)) {
                      handleChange('tags', JSON.stringify([...tags, val]));
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm flex items-center gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-primary/70" 
                      onClick={() => handleChange('tags', JSON.stringify(tags.filter(t => t !== tag)))} 
                    />
                  </span>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>درس معامله</Label>
              <StableTextarea
                placeholder="از این معامله چه یاد گرفتید؟ چه نکته‌ای برای آینده دارد؟"
                value={(trade as any).lesson || ''}
                onChange={e => handleChange('lesson' as any, e.target.value || null)}
                className="min-h-[80px]"
                voice
              />
            </div>
            <div className="space-y-2">
              <Label>General Notes</Label>
              <StableTextarea
                placeholder="Any additional thoughts on this trade..."
                value={trade.notes || ''}
                onChange={e => handleChange('notes', e.target.value)}
                className="min-h-[120px]"
                voice
              />
            </div>
          </div>
        </section>)}

      </div>

    </div>
  );
}
