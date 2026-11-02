# Writes calsim_sample.dss with HEC's official `hecdss` package, then reads it back with
# the same package and saves what it found to calsim_sample.json (the test's expected results).
# hecdss only ships Windows/Linux x86_64 libraries, so on a Mac run it in Docker from this folder:
#   docker run --rm --platform linux/amd64 -v "$PWD":/work -w /work python:3.11-slim \
#     sh -c "pip -q install hecdss numpy && python make_fixtures.py"

import ctypes
import importlib.metadata
import json
import math
import os
from datetime import datetime, timedelta

import hecdss
from hecdss import HecDss, IrregularTimeSeries, PairedData, RegularTimeSeries, Text
from hecdss.dateconverter import DateConverter
from hecdss.record_type import RecordType

DSS_FILE = 'calsim_sample.dss'
JSON_FILE = 'calsim_sample.json'

# Markers DSS treats as "no value": hecdss writes UNDEFINED; older tools write -901 / -902.
UNDEFINED = -3.4028234663852886e38
MISSING_VALUES = (UNDEFINED, -901.0, -902.0)


def month_ends(year, month, count):
    """Period-end stamps for monthly data. DSS's '31OCT1921 24:00' is 1921-11-01 00:00 in Python."""
    times = []
    for _ in range(count):
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
        times.append(datetime(year, month, 1))
    return times


def wave(i, base, amp, period=12.0):
    return round(base + amp * math.sin(2 * math.pi * i / period), 3)


def put_regular(dss, path, times, values, units, data_type, as_float=False):
    if as_float:
        # hecdss's put() always stores doubles; call the native store directly to get floats too.
        date, time = DateConverter.dss_datetime_strings_from_datetime(times[0])
        status = dss._native.hec_dss_tsStoreRegular(path, date, time, list(values), [], [], True,
                                                    units, data_type, '', 0)
    else:
        status = dss.put(RegularTimeSeries.create(values=values, times=times, units=units,
                                                  data_type=data_type, path=path))
    assert status == 0, f'store failed for {path}: {status}'


def write_fixture():
    if os.path.exists(DSS_FILE):
        os.remove(DSS_FILE)
    dss = HecDss(DSS_FILE)

    # Water years 1922-1951 (Oct 1921 - Sep 1951): 360 months over four decade blocks
    # (D parts 01JAN1920, 01JAN1930, 01JAN1940, 01JAN1950). A few full-pool months repeat
    # the same value, so DSS's repeat compression gets used in some blocks.
    storage = [wave(i, 2800, 1500) for i in range(360)]
    for i in (42, 43, 44, 45, 186, 187, 188):
        storage[i] = 4552.0
    put_regular(dss, '/CALSIM/S_SHSTA/STORAGE/01JAN1920/1MON/L2020A/',
                month_ends(1921, 10, 360), storage, 'TAF', 'PER-AVER')

    # Stored as 4-byte floats (the older DSS value size) instead of doubles.
    channel = [wave(i, 9000, 6000) + 0.1 for i in range(120)]
    put_regular(dss, '/CALSIM/C_SAC000/CHANNEL/01JAN1920/1MON/L2020A/',
                month_ends(1921, 10, 120), channel, 'CFS', 'PER-AVER', as_float=True)

    # Water-year type 1-5, constant across each water year (lots of repeats).
    year_types = [1, 2, 3, 5, 4, 2, 2, 3, 1, 5, 4, 3, 3, 2, 1, 1, 4, 5, 2, 3, 4, 4, 1, 2, 5, 3, 3, 4, 2, 1]
    wyt = [float(year_types[i // 12]) for i in range(360)]
    put_regular(dss, '/CALSIM/WYT_SAC_/WATERYEARTYPE/01JAN1920/1MON/L2020A/',
                month_ends(1921, 10, 360), wyt, 'NONE', 'PER-AVER')

    # Missing values: three leading (so the series really starts in Jan 1922) and three
    # interior ones using each marker DSS recognises.
    shortage = [wave(i, 40, 30) for i in range(24)]
    for i in (0, 1, 2, 9):
        shortage[i] = UNDEFINED
    shortage[13] = -901.0
    shortage[17] = -902.0
    put_regular(dss, '/CALSIM/DEL_SAC_NOD/DELIVERY-SHORTAGE/01JAN1920/1MON/L2020A/',
                month_ends(1921, 10, 24), shortage, 'TAF', 'PER-AVER')

    # All one value: DSS stores it once and flags the block as "all the same"
    # (it only compresses blocks with more than 12 values).
    put_regular(dss, '/CALSIM/C_DUMMY/CHANNEL/01JAN1920/1MON/L2020A/',
                month_ends(1921, 10, 24), [0.0] * 24, 'CFS', 'PER-AVER')

    # Daily data uses one-year blocks: WY 1922-1923 spans the 1921, 1922 and 1923 blocks.
    daily_start = datetime(1921, 10, 2)  # 01OCT1921 24:00
    inflow = [wave(i, 5000, 3000, 365.0) for i in range(730)]
    put_regular(dss, '/CALSIM/I_SHSTA/FLOW-INFLOW/01JAN1921/1DAY/L2020A/',
                [daily_start + timedelta(days=i) for i in range(730)], inflow, 'CFS', 'PER-AVER')

    # Daily readings taken at 08:00 (a time offset inside the interval).
    stage_start = datetime(1921, 12, 20, 8, 0)
    put_regular(dss, '/CALSIM/GAGE_KESWICK/STAGE/01JAN1921/1DAY/L2020A/',
                [stage_start + timedelta(days=i) for i in range(20)],
                [wave(i, 480, 3, 7.0) for i in range(20)], 'FT', 'INST-VAL')

    # Irregular series across two IR-YEAR blocks.
    gage_times = [datetime(1921, 12, 15, 6, 30), datetime(1922, 2, 1, 12, 0), datetime(1922, 7, 4, 0, 0)]
    status = dss.put(IrregularTimeSeries.create(values=[1520.5, 3310.0, 980.25], times=gage_times,
                                                units='CFS', data_type='INST-VAL',
                                                path='/CALSIM/GAGE_KESWICK/FLOW-GAGE/01JAN1921/IR-YEAR/L2020A/'))
    assert status == 0, status

    # Records that are not time series and must be skipped.
    status = dss.put(PairedData.create([0.0, 1000.0, 4552.0], [[0.0, 12000.0, 29000.0]], labels=['AREA'],
                                       x_units='TAF', x_type='UNT', y_units='ACRES', y_type='UNT',
                                       path='/CALSIM/S_SHSTA/STORAGE-AREA///L2020A/'))
    assert status == 0, status
    status = dss.put(Text.create('/CALSIM/README/NOTES///L2020A/', 'Sample CalSim 3 style output for tests.'))
    assert status == 0, status
    dss.close()


def dss_date(when):
    """DSS stamps the end of a day as 24:00, so a Python midnight belongs to the day before."""
    if when.hour == 0 and when.minute == 0 and when.second == 0:
        when -= timedelta(days=1)
    return when.strftime('%Y-%m-%d')


def read_expected():
    dss = HecDss(DSS_FILE)
    catalog = dss.get_catalog()
    records = [{'path': path, 'recordType': int(kind)}
               for path, kind in zip(catalog.uncondensed_paths, catalog.rawRecordTypes)]

    series = []
    for item in catalog.items:
        if item.recType not in (RecordType.RegularTimeSeries, RecordType.IrregularTimeSeries):
            continue
        ts = dss.get(str(item))
        points = [{'date': dss_date(t), 'value': float(v)}
                  for t, v in zip(ts.times, ts.values) if float(v) not in MISSING_VALUES]
        # The library's own first/last valid times for the whole series (all D blocks).
        first, last = dss._get_date_time_range(str(item.path_without_date()), 1)
        assert dss_date(first) == points[0]['date'] and dss_date(last) == points[-1]['date'], item
        series.append({
            'a': item.A, 'b': item.B, 'c': item.C, 'e': item.E, 'f': item.F,
            'units': ts.units, 'dataType': ts.data_type,
            'startMonth': points[0]['date'][:7], 'endMonth': points[-1]['date'][:7],
            'regular': item.recType == RecordType.RegularTimeSeries,
            'points': points,
        })
    dss.close()
    return records, series


def file_version(path):
    """Ask the native library which DSS version it thinks a file is (7, 6, or -1 = not DSS)."""
    lib = ctypes.CDLL(os.path.join(os.path.dirname(hecdss.__file__), 'lib', 'libhecdss.so'))
    lib.zgetFileVersion.argtypes = [ctypes.c_char_p]
    return lib.zgetFileVersion(path.encode())


def version_checks():
    with open(DSS_FILE, 'rb') as f:
        data = bytearray(f.read())
    checks = {'fixture': file_version(DSS_FILE)}
    # There's no DSS 6 writer in hecdss, so patch the version text ("7-..." at byte 16) to "6".
    data[16] = ord('6')
    with open('/tmp/patched_v6.dss', 'wb') as f:
        f.write(data)
    checks['versionByte16Patched6'] = file_version('/tmp/patched_v6.dss')
    with open('/tmp/not_dss.dss', 'wb') as f:
        f.write(b'This is not a DSS file.' * 8)
    checks['notDssText'] = file_version('/tmp/not_dss.dss')
    return checks


if __name__ == '__main__':
    write_fixture()
    records, series = read_expected()
    expected = {
        'generatedBy': f'hecdss {importlib.metadata.version("hecdss")}',
        'fileVersion': version_checks(),
        'records': records,
        'series': series,
    }
    with open(JSON_FILE, 'w') as f:
        json.dump(expected, f, separators=(',', ':'))
    print(f'{DSS_FILE}: {os.path.getsize(DSS_FILE)} bytes, {len(records)} records, {len(series)} series')
