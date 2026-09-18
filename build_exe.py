"""Gera o executavel Windows do B2B CTACUSTOS sem abrir console."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
VENV_DIR = PROJECT_ROOT / ".venv"
VENV_PYTHON = VENV_DIR / "Scripts" / "python.exe"
REQUIREMENTS_FILE = PROJECT_ROOT / "requirements.txt"
SPEC_FILE = PROJECT_ROOT / "B2B_CTACUSTOS.spec"
DIST_DIR = PROJECT_ROOT / "dist" / "B2B_CTACUSTOS"
EXE_FILE = DIST_DIR / "B2B_CTACUSTOS.exe"


def run(command: list[str]) -> None:
    """Executa uma etapa do build e interrompe ao primeiro erro."""
    print(f"\n> {subprocess.list2cmdline(command)}", flush=True)
    subprocess.run(command, cwd=PROJECT_ROOT, check=True)


def is_project_venv() -> bool:
    if not VENV_PYTHON.exists():
        return False
    return Path(sys.executable).resolve() == VENV_PYTHON.resolve()


def ensure_project_venv() -> None:
    if VENV_PYTHON.exists():
        return

    print(f"Criando ambiente virtual em: {VENV_DIR}")
    subprocess.run(
        [sys.executable, "-m", "venv", str(VENV_DIR)],
        cwd=PROJECT_ROOT,
        check=True,
    )


def copy_runtime_files() -> None:
    """Copia somente o modelo de configuracao; nunca inclui senhas do .env."""
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    env_example = PROJECT_ROOT / ".env.example"
    if env_example.exists():
        shutil.copy2(env_example, DIST_DIR / ".env.example")


def build(skip_install: bool) -> None:
    if not REQUIREMENTS_FILE.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {REQUIREMENTS_FILE}")
    if not SPEC_FILE.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {SPEC_FILE}")

    if not skip_install:
        run([sys.executable, "-m", "pip", "install", "--upgrade", "pip"])
        run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-r",
                str(REQUIREMENTS_FILE),
            ]
        )

    run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--clean",
            "--noconfirm",
            str(SPEC_FILE),
        ]
    )
    copy_runtime_files()

    if not EXE_FILE.exists():
        raise FileNotFoundError(
            "O PyInstaller terminou, mas o executável esperado não foi encontrado: "
            f"{EXE_FILE}"
        )

    print("\nBuild concluído com sucesso.")
    print(f"Executável: {EXE_FILE}")
    print("O programa foi configurado para iniciar sem janela de console.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gera o B2B_CTACUSTOS.exe sem janela de console."
    )
    parser.add_argument(
        "--skip-install",
        action="store_true",
        help="Não atualiza nem instala dependências antes do build.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if sys.platform != "win32":
        print("Este build deve ser executado no Windows.", file=sys.stderr)
        return 1

    if not is_project_venv():
        ensure_project_venv()
        command = [str(VENV_PYTHON), str(Path(__file__).resolve())]
        if args.skip_install:
            command.append("--skip-install")
        return subprocess.run(command, cwd=PROJECT_ROOT).returncode

    try:
        build(skip_install=args.skip_install)
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        print(f"\nFalha ao gerar o executável: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
