defmodule Loka.Framework.World.Calendar do
  @moduledoc """
  Traditional Chinese Calendar System for Loka.

  Implements the classical Chinese timekeeping and calendar system:
  - 12 Earthly Branches (地支) for hours
  - 10 Heavenly Stems (天干)
  - 60-Year Cycle (六十甲子)
  - 24 Solar Terms (二十四節氣)
  - Lunar months

  ## Game Time

  The game uses an accelerated time cycle where 1 real hour = 1 game day.
  This module maps game time to the traditional calendar system.
  """

  alias Loka.Framework.World.DayNight

  # =============================================================================
  # Earthly Branches (地支) - For Hours
  # =============================================================================

  @earthly_branches [
    %{index: 0, char: "子", pinyin: "zǐ", animal: "Rat", hours: {23, 1}, period: :late_night},
    %{index: 1, char: "丑", pinyin: "chǒu", animal: "Ox", hours: {1, 3}, period: :late_night},
    %{index: 2, char: "寅", pinyin: "yín", animal: "Tiger", hours: {3, 5}, period: :pre_dawn},
    %{index: 3, char: "卯", pinyin: "mǎo", animal: "Rabbit", hours: {5, 7}, period: :dawn},
    %{index: 4, char: "辰", pinyin: "chén", animal: "Dragon", hours: {7, 9}, period: :morning},
    %{index: 5, char: "巳", pinyin: "sì", animal: "Snake", hours: {9, 11}, period: :late_morning},
    %{index: 6, char: "午", pinyin: "wǔ", animal: "Horse", hours: {11, 13}, period: :midday},
    %{index: 7, char: "未", pinyin: "wèi", animal: "Goat", hours: {13, 15}, period: :afternoon},
    %{
      index: 8,
      char: "申",
      pinyin: "shēn",
      animal: "Monkey",
      hours: {15, 17},
      period: :late_afternoon
    },
    %{index: 9, char: "酉", pinyin: "yǒu", animal: "Rooster", hours: {17, 19}, period: :dusk},
    %{index: 10, char: "戌", pinyin: "xū", animal: "Dog", hours: {19, 21}, period: :evening},
    %{index: 11, char: "亥", pinyin: "hài", animal: "Pig", hours: {21, 23}, period: :night}
  ]

  # =============================================================================
  # Heavenly Stems (天干)
  # =============================================================================

  @heavenly_stems [
    %{index: 0, char: "甲", pinyin: "jiǎ", element: :wood, polarity: :yang},
    %{index: 1, char: "乙", pinyin: "yǐ", element: :wood, polarity: :yin},
    %{index: 2, char: "丙", pinyin: "bǐng", element: :fire, polarity: :yang},
    %{index: 3, char: "丁", pinyin: "dīng", element: :fire, polarity: :yin},
    %{index: 4, char: "戊", pinyin: "wù", element: :earth, polarity: :yang},
    %{index: 5, char: "己", pinyin: "jǐ", element: :earth, polarity: :yin},
    %{index: 6, char: "庚", pinyin: "gēng", element: :metal, polarity: :yang},
    %{index: 7, char: "辛", pinyin: "xīn", element: :metal, polarity: :yin},
    %{index: 8, char: "壬", pinyin: "rén", element: :water, polarity: :yang},
    %{index: 9, char: "癸", pinyin: "guǐ", element: :water, polarity: :yin}
  ]

  # =============================================================================
  # 24 Solar Terms (二十四節氣)
  # =============================================================================

  @solar_terms [
    # Spring
    %{
      index: 0,
      char: "立春",
      pinyin: "Lìchūn",
      name: "Spring Begins",
      month: 2,
      day: 4,
      major: false
    },
    %{
      index: 1,
      char: "雨水",
      pinyin: "Yǔshuǐ",
      name: "The Rains Come",
      month: 2,
      day: 19,
      major: false
    },
    %{
      index: 2,
      char: "驚蟄",
      pinyin: "Jīngzhé",
      name: "Insects Stir",
      month: 3,
      day: 6,
      major: false
    },
    %{
      index: 3,
      char: "春分",
      pinyin: "Chūnfēn",
      name: "Vernal Equinox",
      month: 3,
      day: 21,
      major: true
    },
    %{
      index: 4,
      char: "清明",
      pinyin: "Qīngmíng",
      name: "Clear and Bright",
      month: 4,
      day: 5,
      major: true
    },
    %{
      index: 5,
      char: "穀雨",
      pinyin: "Gǔyǔ",
      name: "Rains Nourish Grain",
      month: 4,
      day: 20,
      major: false
    },
    # Summer
    %{
      index: 6,
      char: "立夏",
      pinyin: "Lìxià",
      name: "Summer Begins",
      month: 5,
      day: 6,
      major: false
    },
    %{
      index: 7,
      char: "小滿",
      pinyin: "Xiǎomǎn",
      name: "Grain Fills",
      month: 5,
      day: 21,
      major: false
    },
    %{
      index: 8,
      char: "芒種",
      pinyin: "Mángzhòng",
      name: "Grain in Beard",
      month: 6,
      day: 6,
      major: false
    },
    %{
      index: 9,
      char: "夏至",
      pinyin: "Xiàzhì",
      name: "Summer Solstice",
      month: 6,
      day: 21,
      major: true
    },
    %{
      index: 10,
      char: "小暑",
      pinyin: "Xiǎoshǔ",
      name: "Lesser Heat",
      month: 7,
      day: 7,
      major: false
    },
    %{
      index: 11,
      char: "大暑",
      pinyin: "Dàshǔ",
      name: "Greater Heat",
      month: 7,
      day: 23,
      major: false
    },
    # Autumn
    %{
      index: 12,
      char: "立秋",
      pinyin: "Lìqiū",
      name: "Autumn Begins",
      month: 8,
      day: 8,
      major: false
    },
    %{
      index: 13,
      char: "處暑",
      pinyin: "Chǔshǔ",
      name: "Heat Recedes",
      month: 8,
      day: 23,
      major: false
    },
    %{index: 14, char: "白露", pinyin: "Báilù", name: "White Dew", month: 9, day: 8, major: false},
    %{
      index: 15,
      char: "秋分",
      pinyin: "Qiūfēn",
      name: "Autumnal Equinox",
      month: 9,
      day: 23,
      major: true
    },
    %{index: 16, char: "寒露", pinyin: "Hánlù", name: "Cold Dew", month: 10, day: 8, major: false},
    %{
      index: 17,
      char: "霜降",
      pinyin: "Shuāngjiàng",
      name: "Frost Descends",
      month: 10,
      day: 24,
      major: false
    },
    # Winter
    %{
      index: 18,
      char: "立冬",
      pinyin: "Lìdōng",
      name: "Winter Begins",
      month: 11,
      day: 8,
      major: false
    },
    %{
      index: 19,
      char: "小雪",
      pinyin: "Xiǎoxuě",
      name: "Light Snow",
      month: 11,
      day: 22,
      major: false
    },
    %{
      index: 20,
      char: "大雪",
      pinyin: "Dàxuě",
      name: "Heavy Snow",
      month: 12,
      day: 7,
      major: false
    },
    %{
      index: 21,
      char: "冬至",
      pinyin: "Dōngzhì",
      name: "Winter Solstice",
      month: 12,
      day: 22,
      major: true
    },
    %{
      index: 22,
      char: "小寒",
      pinyin: "Xiǎohán",
      name: "Lesser Cold",
      month: 1,
      day: 6,
      major: false
    },
    %{
      index: 23,
      char: "大寒",
      pinyin: "Dàhán",
      name: "Greater Cold",
      month: 1,
      day: 20,
      major: false
    }
  ]

  # Lunar month names (poetic traditional names)
  @lunar_months [
    %{index: 1, char: "正月", name: "Moon of New Beginnings", season: :spring},
    %{index: 2, char: "二月", name: "Moon of Awakening", season: :spring},
    %{index: 3, char: "三月", name: "Moon of Blossoms", season: :spring},
    %{index: 4, char: "四月", name: "Moon of Growing Light", season: :summer},
    %{index: 5, char: "五月", name: "Moon of High Sun", season: :summer},
    %{index: 6, char: "六月", name: "Moon of Lotus", season: :summer},
    %{index: 7, char: "七月", name: "Moon of Hungry Ghosts", season: :autumn},
    %{index: 8, char: "八月", name: "Moon of Harvest", season: :autumn},
    %{index: 9, char: "九月", name: "Moon of Chrysanthemums", season: :autumn},
    %{index: 10, char: "十月", name: "Moon of Falling Leaves", season: :winter},
    %{index: 11, char: "十一月", name: "Moon of White Frost", season: :winter},
    %{index: 12, char: "十二月", name: "Moon of Bitter Cold", season: :winter}
  ]

  # =============================================================================
  # Moon Phases (月相)
  # =============================================================================

  # Moon cycle: 8 game days = 8 real hours (one complete lunar cycle)
  @moon_cycle_days 8

  @moon_phases [
    %{index: 0, key: :new, name: "New Moon", char: "朔", illumination: 0.0},
    %{index: 1, key: :waxing_crescent, name: "Waxing Crescent", char: "眉月", illumination: 0.25},
    %{index: 2, key: :first_quarter, name: "First Quarter", char: "上弦", illumination: 0.5},
    %{index: 3, key: :waxing_gibbous, name: "Waxing Gibbous", char: "盈凸", illumination: 0.75},
    %{index: 4, key: :full, name: "Full Moon", char: "望", illumination: 1.0},
    %{index: 5, key: :waning_gibbous, name: "Waning Gibbous", char: "亏凸", illumination: 0.75},
    %{index: 6, key: :last_quarter, name: "Last Quarter", char: "下弦", illumination: 0.5},
    %{index: 7, key: :waning_crescent, name: "Waning Crescent", char: "残月", illumination: 0.25}
  ]

  # =============================================================================
  # Game Time State (GenServer for tracking)
  # =============================================================================

  # Game epoch - when year 1, month 1, day 1 started (in real time)
  # We'll use the server start time as a base
  @game_epoch_key :loka_calendar_epoch

  @doc """
  Initialize the calendar system with a starting year.
  Called on application start.
  """
  def init(starting_year \\ 1) do
    :persistent_term.put(@game_epoch_key, %{
      epoch: System.system_time(:second),
      starting_year: starting_year
    })

    :ok
  end

  @doc """
  Get the current game time as a full calendar state.
  """
  def get_time do
    epoch_data =
      :persistent_term.get(@game_epoch_key, %{
        epoch: System.system_time(:second),
        starting_year: 1
      })

    elapsed_seconds = System.system_time(:second) - epoch_data.epoch

    # 1 real hour = 1 game day
    # 1 real day = 24 game days
    # ~15 real days = 1 game year (360 game days)
    # 1 hour = 1 day
    game_days = div(elapsed_seconds, 3600)
    game_year = epoch_data.starting_year + div(game_days, 360)
    day_of_year = rem(game_days, 360) + 1
    game_month = div(day_of_year - 1, 30) + 1
    day_of_month = rem(day_of_year - 1, 30) + 1

    # Current hour from DayNight system
    hour = DayNight.get_hour()

    moon_phase = get_moon_phase_for_day(game_days)

    %{
      hour: hour,
      hour_branch: get_hour_branch(hour),
      day: day_of_month,
      month: game_month,
      month_info: get_lunar_month(game_month),
      year: game_year,
      year_cycle: get_year_cycle(game_year),
      solar_term: get_current_solar_term(game_month, day_of_month),
      phase: DayNight.get_phase(),
      moon_phase: moon_phase
    }
  end

  # Get moon phase for a specific game day count
  defp get_moon_phase_for_day(game_days) do
    phase_index = rem(game_days, @moon_cycle_days)
    Enum.at(@moon_phases, phase_index)
  end

  @doc """
  Get the earthly branch for a given hour (0-23).
  """
  def get_hour_branch(hour) when hour >= 0 and hour <= 23 do
    # Map 24 hours to 12 branches
    # Each branch covers 2 hours, starting with Rat at 23:00
    branch_index =
      cond do
        # 子 Rat
        hour >= 23 or hour < 1 -> 0
        # 丑 Ox
        hour >= 1 and hour < 3 -> 1
        # 寅 Tiger
        hour >= 3 and hour < 5 -> 2
        # 卯 Rabbit
        hour >= 5 and hour < 7 -> 3
        # 辰 Dragon
        hour >= 7 and hour < 9 -> 4
        # 巳 Snake
        hour >= 9 and hour < 11 -> 5
        # 午 Horse
        hour >= 11 and hour < 13 -> 6
        # 未 Goat
        hour >= 13 and hour < 15 -> 7
        # 申 Monkey
        hour >= 15 and hour < 17 -> 8
        # 酉 Rooster
        hour >= 17 and hour < 19 -> 9
        # 戌 Dog
        hour >= 19 and hour < 21 -> 10
        # 亥 Pig
        hour >= 21 and hour < 23 -> 11
      end

    Enum.at(@earthly_branches, branch_index)
  end

  @doc """
  Get the 60-year cycle info for a given year.
  """
  def get_year_cycle(year) do
    # The 60-year cycle starts at year 1
    cycle_position = rem(year - 1, 60)
    stem_index = rem(cycle_position, 10)
    branch_index = rem(cycle_position, 12)

    stem = Enum.at(@heavenly_stems, stem_index)
    branch = Enum.at(@earthly_branches, branch_index)

    %{
      cycle_position: cycle_position + 1,
      stem: stem,
      branch: branch,
      char: stem.char <> branch.char,
      name: "#{element_name(stem.element)} #{branch.animal}",
      element: stem.element,
      animal: branch.animal
    }
  end

  @doc """
  Get lunar month info.
  """
  def get_lunar_month(month) when month >= 1 and month <= 12 do
    Enum.at(@lunar_months, month - 1)
  end

  @doc """
  Get the current solar term based on month and day.
  Returns nil if not on a solar term day.
  """
  def get_current_solar_term(month, day) do
    # Map game month/day to approximate solar term
    # Each solar term lasts about 15 days
    term_index = (month - 1) * 2 + if(day > 15, do: 1, else: 0)
    # Adjust for year starting
    term_index = rem(term_index + 22, 24)

    term = Enum.at(@solar_terms, term_index)

    # Check if we're within a few days of the term's start
    if is_near_solar_term?(month, day, term) do
      term
    else
      nil
    end
  end

  @doc """
  Get the current season based on solar terms.
  """
  def get_season(month) do
    cond do
      month in [2, 3, 4] -> :spring
      month in [5, 6, 7] -> :summer
      month in [8, 9, 10] -> :autumn
      month in [11, 12, 1] -> :winter
    end
  end

  @doc """
  Get the current moon phase based on game days elapsed.

  The moon completes a full cycle every 8 game days (8 real hours).
  """
  def get_moon_phase do
    epoch_data =
      :persistent_term.get(@game_epoch_key, %{
        epoch: System.system_time(:second),
        starting_year: 1
      })

    elapsed_seconds = System.system_time(:second) - epoch_data.epoch

    # 1 real hour = 1 game day, moon cycle = 8 game days
    game_days = div(elapsed_seconds, 3600)
    phase_index = rem(game_days, @moon_cycle_days)

    Enum.at(@moon_phases, phase_index)
  end

  @doc """
  Get the current moon illumination (0.0 to 1.0).
  """
  def get_moon_illumination do
    phase = get_moon_phase()
    phase.illumination
  end

  @doc """
  Get all moon phases (for reference/display).
  """
  def moon_phases, do: @moon_phases

  @doc """
  Get all solar terms (for reference/display).
  """
  def solar_terms, do: @solar_terms

  @doc """
  Get all earthly branches (for reference/display).
  """
  def earthly_branches, do: @earthly_branches

  @doc """
  Get all heavenly stems (for reference/display).
  """
  def heavenly_stems, do: @heavenly_stems

  @doc """
  Format time for display (compact version for UI).
  """
  def format_compact(time \\ get_time()) do
    branch = time.hour_branch
    "#{branch.char}"
  end

  @doc """
  Format time for display (with period name).
  """
  def format_short(time \\ get_time()) do
    branch = time.hour_branch
    phase = time.phase
    "#{branch.char} · #{phase}"
  end

  @doc """
  Format the full date.
  """
  def format_date(time \\ get_time()) do
    month = time.month_info
    year = time.year_cycle
    "#{time.day}#{ordinal(time.day)} day, #{month.name}, Year of the #{year.animal}"
  end

  @doc """
  Format everything for detailed display.
  """
  def format_full(time \\ get_time()) do
    branch = time.hour_branch
    month = time.month_info
    year = time.year_cycle

    base =
      "#{branch.char} · Hour of the #{branch.animal}\n" <>
        "#{time.day}#{ordinal(time.day)} day of the #{month.name}\n" <>
        "#{year.char} · Year of the #{year.name}"

    case time.solar_term do
      nil -> base
      term -> base <> "\n#{term.char} · #{term.name}"
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp element_name(:wood), do: "Wood"
  defp element_name(:fire), do: "Fire"
  defp element_name(:earth), do: "Earth"
  defp element_name(:metal), do: "Metal"
  defp element_name(:water), do: "Water"

  defp ordinal(1), do: "st"
  defp ordinal(2), do: "nd"
  defp ordinal(3), do: "rd"
  defp ordinal(21), do: "st"
  defp ordinal(22), do: "nd"
  defp ordinal(23), do: "rd"
  defp ordinal(31), do: "st"
  defp ordinal(_), do: "th"

  defp is_near_solar_term?(game_month, game_day, term) do
    # Check if we're within 2 days of a solar term
    # This is approximate since we're mapping game time to solar terms
    term_game_month = div(term.index, 2) + 1
    term_game_day = if rem(term.index, 2) == 0, do: 5, else: 20

    game_month == term_game_month and abs(game_day - term_game_day) <= 2
  end
end
