"use client";

import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERSIAN_MONTHS,
  gregorianToJalali,
  jalaliToGregorian,
  dateToJalaliString,
  jalaliStringToIso,
} from "@/lib/jalali";
import { faNumber } from "@/lib/format";

interface JalaliDatePickerProps {
  value?: string; // ISO format (YYYY-MM-DD) or empty
  onChange: (isoDate: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function JalaliDatePicker({
  value,
  onChange,
  label,
  placeholder = "۱۴۰۵/۰۱/۱۵",
  className = "",
  disabled = false,
}: JalaliDatePickerProps) {
  const [showModal, setShowModal] = useState(false);

  // Parse existing date or default to current date
  const initialJalali = value
    ? (() => {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        }
        const now = new Date();
        return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      })()
    : (() => {
        const now = new Date();
        return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      })();

  const [selectedYear, setSelectedYear] = useState<number>(initialJalali.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialJalali.month);
  const [selectedDay, setSelectedDay] = useState<number>(initialJalali.day);

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        setSelectedYear(j.year);
        setSelectedMonth(j.month);
        setSelectedDay(j.day);
      }
    }
  }, [value]);

  const displayString = value ? dateToJalaliString(value) : "";

  const handleApply = (y: number, m: number, d: number) => {
    const g = jalaliToGregorian(y, m, d);
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${g.year}-${pad(g.month)}-${pad(g.day)}`;
    onChange(iso);
    setShowModal(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value.trim();
    if (!text) {
      onChange("");
      return;
    }
    // Check if entered as Jalali YYYY/MM/DD or YYYY-MM-DD
    const normalized = text.replace(/-/g, "/");
    const parts = normalized.split("/");
    if (parts.length === 3 && parts[0].length === 4) {
      const iso = jalaliStringToIso(normalized);
      if (iso) {
        onChange(iso);
      }
    }
  };

  // Generate Year options around current year (e.g. 1400 to 1415)
  const years = Array.from({ length: 16 }, (_, i) => 1400 + i);
  // Days in selected month
  const maxDays = selectedMonth <= 6 ? 31 : selectedMonth <= 11 ? 30 : 29;
  const days = Array.from({ length: maxDays }, (_, i) => i + 1);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-[13px] font-medium text-[var(--text-primary)] block">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <Input
          type="text"
          value={displayString}
          onChange={handleTextChange}
          placeholder={placeholder}
          disabled={disabled}
          className="pe-10 font-mono text-start"
          dir="ltr"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowModal(!showModal)}
          className="absolute inset-y-0 end-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer disabled:opacity-50"
          title="انتخاب از تقویم شمسی"
        >
          <CalendarIcon size={16} />
        </button>
      </div>

      {showModal && (
        <div className="relative z-50 mt-1 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 shadow-xl">
          <div className="text-[12px] font-bold text-[var(--text-primary)] mb-2 flex items-center justify-between">
            <span>انتخاب تاریخ شمسی</span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {displayString ? `${displayString} شمسی` : "امروز"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Day */}
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block mb-1">روز</span>
              <Select
                value={String(selectedDay)}
                onValueChange={(val) => {
                  const d = Number(val);
                  setSelectedDay(d);
                  handleApply(selectedYear, selectedMonth, d);
                }}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue placeholder="روز" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {days.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {faNumber(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month */}
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block mb-1">ماه</span>
              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => {
                  const m = Number(val);
                  setSelectedMonth(m);
                  const validDay = Math.min(selectedDay, m <= 6 ? 31 : m <= 11 ? 30 : 29);
                  setSelectedDay(validDay);
                  handleApply(selectedYear, m, validDay);
                }}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue placeholder="ماه" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {PERSIAN_MONTHS.map((mName, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>
                      {mName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block mb-1">سال</span>
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => {
                  const y = Number(val);
                  setSelectedYear(y);
                  handleApply(y, selectedMonth, selectedDay);
                }}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue placeholder="سال" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {faNumber(y)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const j = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
                setSelectedYear(j.year);
                setSelectedMonth(j.month);
                setSelectedDay(j.day);
                handleApply(j.year, j.month, j.day);
              }}
              className="text-[11px] text-[var(--primary)] hover:underline"
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setShowModal(false);
              }}
              className="text-[11px] text-red-500 hover:underline"
            >
              پاک کردن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
