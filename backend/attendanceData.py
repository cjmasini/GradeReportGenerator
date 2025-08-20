from dataclasses import dataclass, field
from typing import Dict

@dataclass
class AttendanceData:
    """Stores attendance statistics for a student."""
    present: int = 0       # P
    absent: int = 0        # A
    tardy: int = 0         # T
    pfd: int = 0           # PFD
    excused_absence: int = 0           # EA
    excused_absence_transport: int = 0 # K
    excused_absence_medical: int = 0   # M
    out_of_school_suspension: int = 0  # S
    in_school_suspension: int = 0      # I
    school_activity: int = 0           # SA
    field_trip: int = 0                # FT
    testing: int = 0                   # J
    homebound: int = 0                 # H
    no_class: int = 0                  # NC
    quarantine_present: int = 0        # QP
    quarantine_absent: int = 0         # QA
    quarantine_excused_absence: int = 0 # QEA
    other: Dict[str, int] = field(default_factory=dict)

    @property
    def total_days(self) -> int:
        """Total number of recorded attendance days."""
        return (self.present + self.absent + self.tardy + self.pfd +
                self.excused_absence + self.excused_absence_transport +
                self.excused_absence_medical + self.out_of_school_suspension +
                self.in_school_suspension + self.school_activity +
                self.field_trip + self.testing + self.homebound +
                self.no_class + self.quarantine_present +
                self.quarantine_absent + self.quarantine_excused_absence +
                sum(self.other.values()))

    @property
    def total_absences(self) -> int:
        """Total absences including excused and suspensions."""
        return (self.absent + self.excused_absence +
                self.excused_absence_transport + self.excused_absence_medical +
                self.out_of_school_suspension + self.quarantine_absent +
                self.quarantine_excused_absence)

    @property
    def percent_absent(self) -> float:
        """Calculate percentage of absences."""
        if self.total_days == 0:
            return 0.0
        return (self.total_absences / self.total_days) * 100

    @property
    def percent_tardy(self) -> float:
        """Calculate percentage of tardies."""
        attendance_days = self.present + self.tardy + self.pfd + self.quarantine_present
        if attendance_days == 0:
            return 0.0
        return (self.tardy / attendance_days) * 100

    def add_code(self, code: str):
        """Add an attendance code to the appropriate counter."""
        code = code.strip().upper()

        # Skip placeholders / headers
        if not code or code in {'-', 'N/E', 'MF', 'MALE', 'FEMALE'}:
            return

        if code == 'P':
            self.present += 1
        elif code == 'A':
            self.absent += 1
        elif code == 'T':
            self.tardy += 1
        elif code == 'PFD':
            self.pfd += 1
        elif code == 'EA':
            self.excused_absence += 1
        elif code == 'K':
            self.excused_absence_transport += 1
        elif code == 'M':
            self.excused_absence_medical += 1
        elif code == 'S':
            self.out_of_school_suspension += 1
        elif code == 'I':
            self.in_school_suspension += 1
        elif code == 'SA':
            self.school_activity += 1
        elif code == 'FT':
            self.field_trip += 1
        elif code == 'J':
            self.testing += 1
        elif code == 'H':
            self.homebound += 1
        elif code == 'NC':
            self.no_class += 1
        elif code == 'QP':
            self.quarantine_present += 1
        elif code == 'QA':
            self.quarantine_absent += 1
        elif code == 'QEA':
            self.quarantine_excused_absence += 1
        else:
            # Record anything else as "other"
            self.other[code] = self.other.get(code, 0) + 1
