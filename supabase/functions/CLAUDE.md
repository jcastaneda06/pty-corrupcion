# CLAUDE.md

This file provides guidance on how to work with supabase edge functions for `pty-corrupcion`

## Standard

You always have to make sure that the edge function being edited doesn't affect other edge functions negatively. For example:

If the `corrupt-politician` edge function is modified, ask yourself how those modifications will affect the rest of the edge functions?

## Connected functions

Some functions call other funcitons. Make sure to understand how these connect before making changes.