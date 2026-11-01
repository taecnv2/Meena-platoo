import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type SelectHTMLAttributes,
} from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/utils/cn'

interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string
  error?: string
  options: SearchableSelectOption[]
  placeholder?: string
}

/** How many matches to render at once; typing narrows the list further. */
const MAX_VISIBLE = 60

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '')

/** Native value setter, so a programmatic change still reaches React's onChange (and react-hook-form). */
const setNativeSelectValue = (select: HTMLSelectElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  setter?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Drop-in replacement for `Select` for long lists (hundreds of ingredients): staff type part of
 * a name or code instead of scrolling. A hidden native <select> keeps the real value, so
 * `{...register('field')}`, custom `onChange` handlers reading `event.target.value`, `setValue`
 * and `reset` all behave exactly as with the plain Select.
 */
export const SearchableSelect = forwardRef<HTMLSelectElement, SearchableSelectProps>(
  ({ label, error, options, placeholder = 'เลือก', className, id, disabled, value, ...props }, ref) => {
    const selectRef = useRef<HTMLSelectElement>(null)
    useImperativeHandle(ref, () => selectRef.current as HTMLSelectElement)

    const generatedId = useId()
    const inputId = id ?? props.name ?? generatedId
    const listId = `${inputId}-listbox`

    // The hidden select is the source of truth (react-hook-form writes it on setValue/reset and the
    // parent re-renders), so read it on every render; `rerender` covers our own picks and mount.
    const [, rerender] = useReducer((count: number) => count + 1, 0)
    useLayoutEffect(rerender, [rerender])
    const selected = typeof value === 'string' ? value : (selectRef.current?.value ?? '')
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const listRef = useRef<HTMLUListElement>(null)

    const selectedOption = options.find((option) => option.value === selected)

    const matches = useMemo(() => {
      const needle = normalize(query)
      return needle ? options.filter((option) => normalize(option.label).includes(needle)) : options
    }, [options, query])
    const visible = matches.slice(0, MAX_VISIBLE)

    useEffect(() => {
      listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
    }, [activeIndex])

    const open = () => {
      if (disabled) {
        return
      }
      setQuery('')
      setActiveIndex(Math.max(0, options.findIndex((option) => option.value === selected)))
      setIsOpen(true)
    }

    const choose = (option: SearchableSelectOption) => {
      setIsOpen(false)
      setQuery('')
      if (selectRef.current && selectRef.current.value !== option.value) {
        setNativeSelectValue(selectRef.current, option.value)
      }
      rerender()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
        event.preventDefault()
        open()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, visible.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const option = visible[activeIndex]
        if (option) {
          choose(option)
        }
      } else if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        ) : null}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden />
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            placeholder={selectedOption ? selectedOption.label : `${placeholder} (พิมพ์เพื่อค้นหา)`}
            value={isOpen ? query : (selectedOption?.label ?? '')}
            onFocus={open}
            onClick={() => (isOpen ? undefined : open())}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
              setIsOpen(true)
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => setIsOpen(false)}
            className={cn(
              'h-11 w-full rounded-lg border bg-white pl-9 pr-9 text-sm text-text-primary outline-none transition-colors',
              'placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary-light',
              'disabled:cursor-not-allowed disabled:bg-slate-50',
              error ? 'border-danger' : 'border-border',
              className,
            )}
          />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden />
          {isOpen ? (
            <ul
              id={listId}
              ref={listRef}
              role="listbox"
              className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-lg"
            >
              {visible.length === 0 ? (
                <li className="px-3 py-2 text-sm text-text-secondary">ไม่พบรายการที่ตรงกับ "{query}"</li>
              ) : (
                visible.map((option, index) => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={option.value === selected}
                    // mousedown (not click) so the choice lands before the input's blur closes the list
                    onMouseDown={(event) => {
                      event.preventDefault()
                      choose(option)
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'cursor-pointer px-3 py-2 text-sm text-text-primary',
                      index === activeIndex ? 'bg-primary-light' : '',
                      option.value === selected ? 'font-semibold' : '',
                    )}
                  >
                    {option.label}
                  </li>
                ))
              )}
              {matches.length > visible.length ? (
                <li className="px-3 py-2 text-xs text-text-secondary">
                  แสดง {visible.length} จาก {matches.length} รายการ พิมพ์เพิ่มเพื่อค้นหาให้แคบลง
                </li>
              ) : null}
            </ul>
          ) : null}
          <select
            ref={selectRef}
            tabIndex={-1}
            aria-hidden
            disabled={disabled}
            className="sr-only"
            value={value}
            {...props}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {error ? <span className="text-sm text-danger">{error}</span> : null}
      </div>
    )
  },
)
SearchableSelect.displayName = 'SearchableSelect'
